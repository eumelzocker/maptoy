import { randomUUID } from "node:crypto";
import type {
  Job,
  MapSet,
  TileDownloadEstimate,
  TileDownloadInput,
} from "@maptoy/contracts";
import {
  wgs84BoundsToXyzTileRanges,
  wgs84BoundsXyzTileCount,
  wgs84BoundsXyzTiles,
} from "@maptoy/map-core";
import { JobStateError } from "../jobs/errors.js";
import type { JobController } from "../jobs/service.js";
import type { JobRepository } from "../layers/repository.js";
import type { MapSetService } from "../mapSets/service.js";
import { TileArchiveError, type TileArchiveService } from "../tiles/service.js";

interface StoredDownloadInput extends Record<string, unknown> {
  mapSetId: string;
  bounds: TileDownloadInput["bounds"];
  minimumZoom: number;
  maximumZoom: number;
  refreshMode: TileDownloadInput["refreshMode"];
}

type TileCoordinate = { zoom: number; x: number; y: number };
type RequestAllowance = { remaining: number | null };
type DownloadResult =
  | { kind: "cached"; attempts: number; retries: number }
  | { kind: "downloaded" | "validated"; attempts: number; retries: number }
  | { kind: "failed"; attempts: number; retries: number; message: string };

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tileKey(tile: TileCoordinate): string {
  return `${tile.zoom}/${tile.x}/${tile.y}`;
}

export class TileDownloadService implements JobController {
  readonly type = "tile-download" as const;
  private activeRun: Promise<void> | null = null;
  private shuttingDown = false;
  private nextRequestAt = 0;

  constructor(
    private readonly mapSets: MapSetService,
    private readonly tileArchive: TileArchiveService,
    private readonly jobs: JobRepository,
    private readonly limits: {
      warningTileCount: number;
      maximumTileCount: number;
      errorHistoryLimit: number;
    },
  ) {}

  initialize(): void {
    this.jobs.recoverInterrupted(this.type);
    this.pump();
  }

  estimate(mapSetId: string, input: TileDownloadInput): TileDownloadEstimate {
    const mapSet = this.mapSets.get(mapSetId);
    this.validate(mapSet, input);
    const totalTiles = wgs84BoundsXyzTileCount(
      input.bounds,
      input.minimumZoom,
      input.maximumZoom,
    );
    const ranges = Array.from(
      { length: input.maximumZoom - input.minimumZoom + 1 },
      (_, index) => input.minimumZoom + index,
    ).flatMap((zoom) =>
      wgs84BoundsToXyzTileRanges(input.bounds, zoom).map((range) => ({
        zoom,
        range,
      })),
    );
    const cache = this.tileArchive.downloadCacheSummary(
      mapSet,
      ranges,
      totalTiles,
    );
    const requestTiles =
      input.refreshMode === "missing"
        ? cache.missingTiles
        : cache.missingTiles + cache.staleTiles;
    const dailyRequestsRemaining = this.dailyRequestsRemaining(mapSet);
    const estimatedBytes =
      cache.averageCachedBytes === null
        ? null
        : cache.averageCachedBytes * requestTiles;
    const warnings: string[] = [];
    const blockedReasons: string[] = [];
    if (totalTiles >= this.limits.warningTileCount) {
      warnings.push(
        `The selected area contains ${totalTiles.toLocaleString("en-US")} Tiles and may take a long time.`,
      );
    }
    if (totalTiles > this.limits.maximumTileCount) {
      blockedReasons.push(
        `The selected area exceeds MAPTOY_DOWNLOADS_MAX_TILE_COUNT (${this.limits.maximumTileCount.toLocaleString("en-US")}).`,
      );
    }
    if (
      dailyRequestsRemaining !== null &&
      requestTiles > dailyRequestsRemaining
    ) {
      blockedReasons.push(
        `The estimated ${requestTiles.toLocaleString("en-US")} provider requests exceed the Map Set's remaining daily request allowance (${dailyRequestsRemaining.toLocaleString("en-US")}).`,
      );
    }
    const storageLimit = mapSet.cachePolicy.maximumStorageBytes;
    if (storageLimit !== null && estimatedBytes !== null) {
      const currentBytes = this.tileArchive.stats(mapSet.id).totalStorageBytes;
      if (currentBytes + estimatedBytes > storageLimit) {
        blockedReasons.push(
          "The estimated download would exceed this Map Set's configured storage limit.",
        );
      }
    }
    const { averageCachedBytes: _averageCachedBytes, ...cacheCounts } = cache;
    return {
      ...input,
      totalTiles,
      ...cacheCounts,
      requestTiles,
      estimatedBytes,
      warningTileCount: this.limits.warningTileCount,
      maximumTileCount: this.limits.maximumTileCount,
      dailyRequestLimit: mapSet.downloadPolicy.dailyRequestLimit,
      dailyRequestsRemaining,
      warnings,
      blockedReasons,
    };
  }

  start(mapSetId: string, input: TileDownloadInput): Job {
    const estimate = this.estimate(mapSetId, input);
    if (estimate.blockedReasons.length > 0) {
      throw new JobStateError(estimate.blockedReasons[0] as string);
    }
    const hasActiveJob = this.jobs
      .list()
      .some(
        (job) =>
          job.type === this.type &&
          job.input.mapSetId === mapSetId &&
          ["queued", "running", "paused"].includes(job.status),
      );
    if (hasActiveJob) {
      throw new JobStateError(
        "This Map Set already has an active Tile Download Job.",
      );
    }
    const timestamp = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      type: this.type,
      status: "queued",
      input: { mapSetId, ...input },
      total: estimate.totalTiles,
      completed: 0,
      skipped: 0,
      failed: 0,
      summary: {
        requested: 0,
        downloaded: 0,
        validated: 0,
        cached: 0,
        retries: 0,
      },
      lastError: null,
      createdAt: timestamp,
      startedAt: null,
      updatedAt: timestamp,
      finishedAt: null,
    };
    this.jobs.insert(job);
    this.pump();
    return job;
  }

  assertMapSetIdle(mapSetId: string): void {
    const active = this.jobs
      .list()
      .some(
        (job) =>
          job.type === this.type &&
          job.input.mapSetId === mapSetId &&
          ["queued", "running", "paused"].includes(job.status),
      );
    if (active) {
      throw new JobStateError(
        "Cancel the active Tile Download Job before deleting this Map Set.",
      );
    }
  }

  pause(id: string): Job {
    const job = this.getJob(id);
    if (job.status !== "queued" && job.status !== "running") {
      throw new JobStateError("Only queued or running jobs can be paused.");
    }
    const updated = {
      ...job,
      status: "paused" as const,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.update(updated);
    return updated;
  }

  resume(id: string): Job {
    const job = this.getJob(id);
    if (job.status !== "paused") {
      throw new JobStateError("Only paused jobs can be resumed.");
    }
    const updated = {
      ...job,
      status: "queued" as const,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.update(updated);
    this.pump();
    return updated;
  }

  cancel(id: string): Job {
    const job = this.getJob(id);
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      throw new JobStateError("The job has already finished.");
    }
    const timestamp = new Date().toISOString();
    const updated = {
      ...job,
      status: "cancelled" as const,
      updatedAt: timestamp,
      finishedAt: timestamp,
    };
    this.jobs.update(updated);
    return updated;
  }

  retry(id: string): Job {
    const job = this.getJob(id);
    if (
      job.status !== "failed" &&
      job.status !== "cancelled" &&
      !(job.status === "completed" && job.failed > 0)
    ) {
      throw new JobStateError(
        "Only failed, cancelled, or partially completed Tile Downloads can be retried.",
      );
    }
    const input = job.input as StoredDownloadInput;
    return this.start(input.mapSetId, {
      bounds: input.bounds,
      minimumZoom: input.minimumZoom,
      maximumZoom: input.maximumZoom,
      refreshMode: input.refreshMode,
    });
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await this.activeRun;
  }

  private validate(mapSet: MapSet, input: TileDownloadInput): void {
    if (
      !mapSet.capabilities.batchDownload ||
      !mapSet.capabilities.tileArchive ||
      !mapSet.cachePolicy.enabled
    ) {
      throw new JobStateError(
        "Tile Downloads require Batch Download and Tile Archive capabilities with caching enabled.",
      );
    }
    if (input.bounds.south >= input.bounds.north) {
      throw new JobStateError(
        "Download bounds require north to be above south.",
      );
    }
    if (input.bounds.west === input.bounds.east) {
      throw new JobStateError(
        "Download bounds require a non-empty longitude span.",
      );
    }
    if (
      input.minimumZoom > input.maximumZoom ||
      input.minimumZoom < mapSet.minZoom ||
      input.maximumZoom > mapSet.maxZoom
    ) {
      throw new JobStateError(
        `Download zooms must stay inside the Map Set range ${mapSet.minZoom}–${mapSet.maxZoom}.`,
      );
    }
  }

  private dailyRequestsRemaining(mapSet: MapSet): number | null {
    const limit = mapSet.downloadPolicy.dailyRequestLimit;
    if (limit === null) return null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const used = this.jobs
      .list()
      .filter(
        (job) =>
          job.type === this.type &&
          job.input.mapSetId === mapSet.id &&
          job.createdAt >= today.toISOString(),
      )
      .reduce((total, job) => total + (job.summary.requested ?? 0), 0);
    return Math.max(0, limit - used);
  }

  private getJob(id: string): Job {
    const job = this.jobs.get(id);
    if (job === undefined || job.type !== this.type) {
      throw new JobStateError("The requested Job is not a Tile Download.");
    }
    return job;
  }

  private pump(): void {
    if (this.activeRun !== null || this.shuttingDown) return;
    const next = this.jobs
      .list()
      .filter((job) => job.type === this.type && job.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
    if (next === undefined) return;
    this.activeRun = this.run(next)
      .catch(() => undefined)
      .finally(() => {
        this.activeRun = null;
        this.pump();
      });
  }

  private async run(initialJob: Job): Promise<void> {
    const input = initialJob.input as StoredDownloadInput;
    const mapSet = this.mapSets.get(input.mapSetId);
    let job: Job = {
      ...initialJob,
      status: "running",
      startedAt: initialJob.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finishedAt: null,
      lastError: null,
    };
    this.jobs.update(job);
    try {
      const tiles = [
        ...wgs84BoundsXyzTiles(
          input.bounds,
          input.minimumZoom,
          input.maximumZoom,
        ),
      ];
      const cursor = this.jobs.progressCursor(job.id);
      const cursorIndex =
        cursor === null
          ? -1
          : tiles.findIndex((tile) => tileKey(tile) === cursor);
      const remaining = tiles.slice(cursorIndex + 1);
      const concurrency = mapSet.downloadPolicy.concurrency;
      const requestAllowance: RequestAllowance = {
        remaining: this.dailyRequestsRemaining(mapSet),
      };
      for (let offset = 0; offset < remaining.length; offset += concurrency) {
        if (this.stopRequested(job.id)) return;
        const batch = remaining.slice(offset, offset + concurrency);
        const current = batch[0];
        if (current === undefined) break;
        job = {
          ...this.getJob(job.id),
          summary: {
            ...this.getJob(job.id).summary,
            currentZoom: current.zoom,
            currentX: current.x,
            currentY: current.y,
          },
          updatedAt: new Date().toISOString(),
        };
        this.jobs.update(job);
        const results = await Promise.all(
          batch.map((tile) =>
            this.processTile(
              job.id,
              mapSet,
              tile,
              input.refreshMode,
              requestAllowance,
            ),
          ),
        );
        const latest = this.getJob(job.id);
        const progress = results.reduce(
          (counts, result) => ({
            completed:
              counts.completed +
              (result.kind === "downloaded" || result.kind === "validated"
                ? 1
                : 0),
            skipped: counts.skipped + (result.kind === "cached" ? 1 : 0),
            failed: counts.failed + (result.kind === "failed" ? 1 : 0),
            requested: counts.requested + result.attempts,
            retries: counts.retries + result.retries,
            downloaded:
              counts.downloaded + (result.kind === "downloaded" ? 1 : 0),
            validated: counts.validated + (result.kind === "validated" ? 1 : 0),
            cached: counts.cached + (result.kind === "cached" ? 1 : 0),
          }),
          {
            completed: 0,
            skipped: 0,
            failed: 0,
            requested: 0,
            retries: 0,
            downloaded: 0,
            validated: 0,
            cached: 0,
          },
        );
        job = {
          ...latest,
          completed: latest.completed + progress.completed,
          skipped: latest.skipped + progress.skipped,
          failed: latest.failed + progress.failed,
          summary: {
            ...latest.summary,
            requested: (latest.summary.requested ?? 0) + progress.requested,
            retries: (latest.summary.retries ?? 0) + progress.retries,
            downloaded: (latest.summary.downloaded ?? 0) + progress.downloaded,
            validated: (latest.summary.validated ?? 0) + progress.validated,
            cached: (latest.summary.cached ?? 0) + progress.cached,
          },
          updatedAt: new Date().toISOString(),
        };
        const last = batch.at(-1);
        if (last === undefined) throw new Error("Download batch is empty.");
        this.jobs.updateProgress(job, tileKey(last));
      }
      if (this.stopRequested(job.id)) return;
      const finishedAt = new Date().toISOString();
      const latest = this.getJob(job.id);
      this.jobs.update({
        ...latest,
        status: "completed",
        summary: Object.fromEntries(
          Object.entries(latest.summary).filter(
            ([key]) => !key.startsWith("current"),
          ),
        ),
        updatedAt: finishedAt,
        finishedAt,
      });
    } catch (error) {
      const latest = this.jobs.get(job.id);
      if (latest?.status === "paused" || latest?.status === "cancelled") return;
      const timestamp = new Date().toISOString();
      const message =
        error instanceof Error ? error.message : "The Tile Download failed.";
      this.jobs.addError(
        job.id,
        {
          code: "TILE_DOWNLOAD_FAILED",
          message,
          item: null,
          createdAt: timestamp,
        },
        this.limits.errorHistoryLimit,
      );
      if (latest !== undefined) {
        this.jobs.update({
          ...latest,
          status: "failed",
          lastError: message,
          updatedAt: timestamp,
          finishedAt: timestamp,
        });
      }
    }
  }

  private stopRequested(jobId: string): boolean {
    const current = this.getJob(jobId);
    if (this.shuttingDown && current.status === "running") {
      this.jobs.update({
        ...current,
        status: "queued",
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
    return current.status !== "running";
  }

  private async processTile(
    jobId: string,
    mapSet: MapSet,
    tile: TileCoordinate,
    refreshMode: TileDownloadInput["refreshMode"],
    requestAllowance: RequestAllowance,
  ): Promise<DownloadResult> {
    const state = this.tileArchive.cacheState(mapSet, tile);
    if (state === "fresh" || (state === "stale" && refreshMode === "missing")) {
      return { kind: "cached", attempts: 0, retries: 0 };
    }
    const retryLimit = mapSet.downloadPolicy.retryLimit;
    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      if (requestAllowance.remaining === 0) {
        const message =
          "The Map Set's daily provider request limit has been reached.";
        this.jobs.addError(
          jobId,
          {
            code: "PROVIDER_DAILY_LIMIT_REACHED",
            message,
            item: tileKey(tile),
            createdAt: new Date().toISOString(),
          },
          this.limits.errorHistoryLimit,
        );
        return {
          kind: "failed",
          attempts: attempt,
          retries: Math.max(0, attempt - 1),
          message,
        };
      }
      if (requestAllowance.remaining !== null) {
        requestAllowance.remaining -= 1;
      }
      try {
        await this.waitForRate(mapSet.downloadPolicy.requestsPerSecond);
        const response = await this.mapSets.tile(mapSet.id, tile, {
          refresh: "force",
          selection: { kind: "current" },
        });
        return {
          kind: response.cacheStatus === "miss" ? "downloaded" : "validated",
          attempts: attempt + 1,
          retries: attempt,
        };
      } catch (error) {
        if (attempt < retryLimit) {
          const retryAfter =
            error instanceof TileArchiveError
              ? error.retryAfterMilliseconds
              : null;
          await sleep(retryAfter ?? Math.min(30_000, 250 * 2 ** attempt));
          continue;
        }
        const message =
          error instanceof Error ? error.message : "Tile request failed.";
        this.jobs.addError(
          jobId,
          {
            code:
              error instanceof TileArchiveError &&
              error.providerStatusCode === 429
                ? "PROVIDER_RATE_LIMITED"
                : "TILE_DOWNLOAD_ITEM_FAILED",
            message,
            item: tileKey(tile),
            createdAt: new Date().toISOString(),
          },
          this.limits.errorHistoryLimit,
        );
        return {
          kind: "failed",
          attempts: attempt + 1,
          retries: attempt,
          message,
        };
      }
    }
    throw new Error("Tile retry loop ended unexpectedly.");
  }

  private async waitForRate(requestsPerSecond: number): Promise<void> {
    const interval = 1000 / requestsPerSecond;
    const scheduledAt = Math.max(Date.now(), this.nextRequestAt);
    this.nextRequestAt = scheduledAt + interval;
    const delay = scheduledAt - Date.now();
    if (delay > 0) await sleep(delay);
  }
}
