import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type {
  PhotoScanJobInput,
  Job,
  LayerAsset,
  LayerAssetPatch,
} from "@maptoy/contracts";
import type { LayerService } from "./service.js";
import type {
  JobRepository,
  LayerRepository,
  StoredLayerAsset,
} from "./repository.js";
import type { ImagePreviewStorage } from "./imagePreviewStorage.js";
import type { PhotoDirectory, ResolvedPhotoFile } from "./photoDirectory.js";

const executeFile = promisify(execFile);

export class JobNotFoundError extends Error {
  readonly code = "JOB_NOT_FOUND";
  readonly statusCode = 404;

  constructor() {
    super("The requested job does not exist.");
    this.name = "JobNotFoundError";
  }
}

export class JobStateError extends Error {
  readonly code = "JOB_STATE_INVALID";
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "JobStateError";
  }
}

interface StoredScanInput extends Record<string, unknown> {
  layerId: string;
  relativeDirectory: string;
  recursive: boolean;
}

interface ExifToolResult {
  GPSLatitude?: number;
  GPSLongitude?: number;
  DateTimeOriginal?: string;
}

async function readExif(filePath: string): Promise<{
  longitude: number | null;
  latitude: number | null;
  capturedAt: string | null;
}> {
  const { stdout } = await executeFile(
    "exiftool",
    [
      "-json",
      "-n",
      "-GPSLatitude",
      "-GPSLongitude",
      "-DateTimeOriginal",
      filePath,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  const first = (JSON.parse(stdout) as ExifToolResult[])[0];
  const longitude =
    typeof first?.GPSLongitude === "number" ? first.GPSLongitude : null;
  const latitude =
    typeof first?.GPSLatitude === "number" ? first.GPSLatitude : null;
  return {
    longitude,
    latitude,
    capturedAt:
      typeof first?.DateTimeOriginal === "string"
        ? first.DateTimeOriginal
        : null,
  };
}

function isInScanScope(
  relativePath: string,
  relativeDirectory: string,
  recursive: boolean,
): boolean {
  if (relativeDirectory === "") {
    return recursive || !relativePath.includes(path.sep);
  }
  const relative = path.relative(relativeDirectory, relativePath);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return false;
  }
  return recursive || !relative.includes(path.sep);
}

function publicAsset(asset: StoredLayerAsset): LayerAsset {
  const {
    managedPath: _managedPath,
    previewPath: _previewPath,
    sourceRootId: _sourceRootId,
    sourceFingerprint: _sourceFingerprint,
    metadata: _metadata,
    ...result
  } = asset;
  return result;
}

export class PhotoScanService {
  private activeRun: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(
    private readonly layers: LayerService,
    private readonly layerRepository: LayerRepository,
    private readonly jobs: JobRepository,
    readonly directory: PhotoDirectory,
    private readonly previews: ImagePreviewStorage,
    private readonly limits: {
      batchSize: number;
      decoderConcurrency: number;
      maximumFiles: number;
    },
  ) {}

  async initialize(): Promise<void> {
    await this.previews.initialize();
    this.jobs.recoverInterrupted();
    this.pump();
  }

  listJobs(): Job[] {
    return this.jobs.list();
  }

  getJob(id: string): Job {
    const job = this.jobs.get(id);
    if (job === undefined) {
      throw new JobNotFoundError();
    }
    return job;
  }

  assertLayerIdle(layerId: string): void {
    const active = this.jobs
      .list()
      .some(
        (job) =>
          job.input.layerId === layerId &&
          (job.status === "queued" ||
            job.status === "running" ||
            job.status === "paused"),
      );
    if (active) {
      throw new JobStateError(
        "Pause is not sufficient for deletion; cancel the active Layer Job first.",
      );
    }
  }

  listAssets(
    layerId: string,
    limit: number,
    cursor?: string,
  ): { items: LayerAsset[]; nextCursor: string | null } {
    this.layers.get(layerId);
    const assets = this.layerRepository.listAssets(layerId, limit + 1, cursor);
    const hasMore = assets.length > limit;
    const page = hasMore ? assets.slice(0, limit) : assets;
    return {
      items: page.map(publicAsset),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  getAsset(layerId: string, assetId: string): StoredLayerAsset {
    this.layers.get(layerId);
    const asset = this.layerRepository.getAsset(assetId);
    if (asset === undefined || asset.layerId !== layerId) {
      throw new LayerAssetNotFoundError();
    }
    return asset;
  }

  updateAsset(
    layerId: string,
    assetId: string,
    patch: LayerAssetPatch,
  ): LayerAsset {
    const asset = this.getAsset(layerId, assetId);
    const hasCoordinate = patch.longitude !== null && patch.latitude !== null;
    if (
      (patch.longitude === null) !== (patch.latitude === null) ||
      (patch.bounds !== null &&
        (patch.bounds.west >= patch.bounds.east ||
          patch.bounds.south >= patch.bounds.north)) ||
      (hasCoordinate && patch.bounds !== null)
    ) {
      throw new JobStateError(
        "Use either a complete point coordinate or valid photo bounds.",
      );
    }
    const updated: StoredLayerAsset = {
      ...asset,
      longitude: patch.longitude,
      latitude: patch.latitude,
      coordinateSource: hasCoordinate ? "manual" : "none",
      bounds: patch.bounds,
      updatedAt: new Date().toISOString(),
    };
    this.layerRepository.upsertAsset(updated);
    return publicAsset(updated);
  }

  previewPath(layerId: string, assetId: string): string {
    const asset = this.getAsset(layerId, assetId);
    if (asset.previewPath === null) {
      throw new LayerAssetNotFoundError();
    }
    return this.previews.resolvePreview(asset.previewPath);
  }

  async deleteLayerPreviews(layerId: string): Promise<void> {
    await Promise.all(
      this.layerRepository
        .listAllAssets(layerId)
        .flatMap((asset) =>
          asset.previewPath === null
            ? []
            : [this.previews.remove(asset.previewPath)],
        ),
    );
  }

  start(layerId: string, input: PhotoScanJobInput): Job {
    const layer = this.layers.get(layerId);
    if (layer.pluginId !== "photo-layer") {
      throw new JobStateError(
        "Photo scans can only target a photo-layer instance.",
      );
    }
    const timestamp = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      type: "photo-scan",
      status: "queued",
      input: { layerId, ...input },
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      summary: {
        created: 0,
        changed: 0,
        unchanged: 0,
        missing: 0,
        failed: 0,
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
    if (
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
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

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await this.activeRun;
  }

  private pump(): void {
    if (this.activeRun !== null || this.shuttingDown) {
      return;
    }
    const next = this.jobs
      .list()
      .filter((job) => job.type === "photo-scan" && job.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
    if (next === undefined) {
      return;
    }
    this.activeRun = this.run(next)
      .catch(() => undefined)
      .finally(() => {
        this.activeRun = null;
        this.pump();
      });
  }

  private async run(initialJob: Job): Promise<void> {
    const input = initialJob.input as StoredScanInput;
    const startedAt = initialJob.startedAt ?? new Date().toISOString();
    let job: Job = {
      ...initialJob,
      status: "running",
      startedAt,
      updatedAt: new Date().toISOString(),
      finishedAt: null,
      lastError: null,
    };
    this.jobs.update(job);
    try {
      const files = await this.directory.files(
        input.relativeDirectory,
        input.recursive,
      );
      if (files.length > this.limits.maximumFiles) {
        throw new Error(
          `The scan found ${files.length} photos; MAPTOY_PHOTOS_SCAN_MAX_FILES allows ${this.limits.maximumFiles}.`,
        );
      }
      job = {
        ...job,
        total: files.length,
        updatedAt: new Date().toISOString(),
      };
      this.jobs.update(job);
      const existing = this.layerRepository.listExternalPhotos(input.layerId);
      const seen = new Set<string>();
      for (
        let batchStart = 0;
        batchStart < files.length;
        batchStart += this.limits.batchSize
      ) {
        const batch = files.slice(
          batchStart,
          batchStart + this.limits.batchSize,
        );
        for (
          let chunkStart = 0;
          chunkStart < batch.length;
          chunkStart += this.limits.decoderConcurrency
        ) {
          const current = this.getJob(job.id);
          if (current.status !== "running" || this.shuttingDown) {
            if (this.shuttingDown && current.status === "running") {
              this.jobs.update({
                ...current,
                status: "queued",
                updatedAt: new Date().toISOString(),
              });
            }
            return;
          }
          const chunk = batch.slice(
            chunkStart,
            chunkStart + this.limits.decoderConcurrency,
          );
          const results = await Promise.all(
            chunk.map(async (file) => {
              seen.add(file.relativePath);
              const previous = this.layerRepository.getExternalPhoto(
                input.layerId,
                file.relativePath,
              );
              return this.processFile(input.layerId, file, previous);
            }),
          );
          const progress = results.reduce(
            (counts, result) => ({
              created: counts.created + (result === "created" ? 1 : 0),
              changed: counts.changed + (result === "changed" ? 1 : 0),
              unchanged: counts.unchanged + (result === "unchanged" ? 1 : 0),
              failed: counts.failed + (result === "failed" ? 1 : 0),
            }),
            { created: 0, changed: 0, unchanged: 0, failed: 0 },
          );
          const latest = this.getJob(job.id);
          job = {
            ...latest,
            completed: latest.completed + progress.created + progress.changed,
            skipped: latest.skipped + progress.unchanged,
            failed: latest.failed + progress.failed,
            summary: {
              ...latest.summary,
              created: (latest.summary.created ?? 0) + progress.created,
              changed: (latest.summary.changed ?? 0) + progress.changed,
              unchanged: (latest.summary.unchanged ?? 0) + progress.unchanged,
              failed: (latest.summary.failed ?? 0) + progress.failed,
            },
            updatedAt: new Date().toISOString(),
          };
          this.jobs.update(job);
        }
      }
      let missing = 0;
      for (const asset of existing) {
        if (
          asset.relativePath !== null &&
          isInScanScope(
            asset.relativePath,
            input.relativeDirectory,
            input.recursive,
          ) &&
          !seen.has(asset.relativePath) &&
          asset.status !== "missing"
        ) {
          this.layerRepository.upsertAsset({
            ...asset,
            status: "missing",
            errorCode: "PHOTO_SOURCE_MISSING",
            errorMessage: "The external photo file is no longer available.",
            updatedAt: new Date().toISOString(),
          });
          missing += 1;
        }
      }
      const finishedAt = new Date().toISOString();
      const latest = this.getJob(job.id);
      this.jobs.update({
        ...latest,
        status: "completed",
        summary: {
          ...latest.summary,
          missing: (latest.summary.missing ?? 0) + missing,
        },
        updatedAt: finishedAt,
        finishedAt,
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      this.jobs.update({
        ...this.getJob(job.id),
        status: "failed",
        lastError:
          error instanceof Error ? error.message : "The photo scan failed.",
        updatedAt: timestamp,
        finishedAt: timestamp,
      });
    }
  }

  private async processFile(
    layerId: string,
    file: ResolvedPhotoFile,
    previous: StoredLayerAsset | undefined,
  ): Promise<"created" | "changed" | "unchanged" | "failed"> {
    const timestamp = new Date().toISOString();
    const assetId = previous?.id ?? randomUUID();
    try {
      const fingerprint = await this.previews.fingerprint(file.absolutePath);
      if (previous?.sourceFingerprint === fingerprint.sourceFingerprint) {
        if (previous.status === "ready") {
          return "unchanged";
        }
        if (previous.previewPath !== null) {
          this.layerRepository.upsertAsset({
            ...previous,
            status: "ready",
            byteLength: fingerprint.byteLength,
            sourceModifiedAt: fingerprint.sourceModifiedAt,
            errorCode: null,
            errorMessage: null,
            updatedAt: timestamp,
          });
          return "changed";
        }
      }
      const processed = await this.previews.process(assetId, file.absolutePath);
      const exif = await readExif(file.absolutePath);
      const preserveCoordinate =
        previous !== undefined && previous.coordinateSource !== "exif";
      const hasExifCoordinate =
        exif.longitude !== null && exif.latitude !== null;
      const asset: StoredLayerAsset = {
        id: assetId,
        layerId,
        kind: "external-photo",
        status: "ready",
        fileName: path.basename(file.relativePath),
        contentType: processed.contentType,
        byteLength: processed.byteLength,
        contentHash: processed.contentHash,
        sourceRootId: "photos",
        relativePath: file.relativePath,
        sourceModifiedAt: processed.sourceModifiedAt,
        width: processed.width,
        height: processed.height,
        longitude: preserveCoordinate
          ? (previous.longitude ?? null)
          : exif.longitude,
        latitude: preserveCoordinate
          ? (previous.latitude ?? null)
          : exif.latitude,
        coordinateSource: preserveCoordinate
          ? previous.coordinateSource
          : hasExifCoordinate
            ? "exif"
            : "none",
        previewAvailable: true,
        errorCode: null,
        errorMessage: null,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        managedPath: null,
        previewPath: processed.previewPath,
        sourceFingerprint: processed.sourceFingerprint,
        bounds: previous?.bounds ?? null,
        metadata: {
          ...processed.metadata,
          capturedAt: exif.capturedAt,
        },
      };
      this.layerRepository.upsertAsset(asset);
      if (
        previous?.previewPath !== null &&
        previous?.previewPath !== undefined &&
        previous.previewPath !== processed.previewPath
      ) {
        await this.previews.remove(previous.previewPath);
      }
      return previous === undefined ? "created" : "changed";
    } catch (error) {
      this.layerRepository.upsertAsset({
        id: assetId,
        layerId,
        kind: "external-photo",
        status: "failed",
        fileName: path.basename(file.relativePath),
        contentType: previous?.contentType ?? null,
        byteLength: previous?.byteLength ?? null,
        contentHash: previous?.contentHash ?? null,
        sourceRootId: "photos",
        relativePath: file.relativePath,
        sourceModifiedAt: previous?.sourceModifiedAt ?? null,
        width: previous?.width ?? null,
        height: previous?.height ?? null,
        longitude: previous?.longitude ?? null,
        latitude: previous?.latitude ?? null,
        coordinateSource: previous?.coordinateSource ?? "none",
        previewAvailable: previous?.previewAvailable ?? false,
        errorCode: "PHOTO_PROCESSING_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Photo processing failed.",
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        managedPath: null,
        previewPath: previous?.previewPath ?? null,
        sourceFingerprint: previous?.sourceFingerprint ?? null,
        bounds: previous?.bounds ?? null,
        metadata: previous?.metadata ?? {},
      });
      return "failed";
    }
  }
}

export class LayerAssetNotFoundError extends Error {
  readonly code = "LAYER_ASSET_NOT_FOUND";
  readonly statusCode = 404;

  constructor() {
    super("The requested layer asset does not exist.");
    this.name = "LayerAssetNotFoundError";
  }
}
