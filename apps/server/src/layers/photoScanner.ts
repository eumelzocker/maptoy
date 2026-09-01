import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type {
  Job,
  JobCleanupResponse,
  JobError,
  LayerAsset,
  LayerAssetExtent,
  LayerAssetPatch,
  PhotoScanJobInput,
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
  Make?: string;
  Model?: string;
  ISO?: number;
  FNumber?: number;
  ExposureTime?: number;
  "Caption-Abstract"?: string;
}

function optionalMetadataText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function validPhotoCoordinate(
  longitude: unknown,
  latitude: unknown,
): longitude is number {
  return (
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}

async function readExif(filePath: string): Promise<{
  longitude: number | null;
  latitude: number | null;
  metadata: Readonly<Record<string, unknown>>;
}> {
  const { stdout } = await executeFile(
    "exiftool",
    [
      "-json",
      "-n",
      "-GPSLatitude",
      "-GPSLongitude",
      "-DateTimeOriginal",
      "-Make",
      "-Model",
      "-ISO",
      "-FNumber",
      "-ExposureTime",
      "-IPTC:Caption-Abstract",
      filePath,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  const first = (JSON.parse(stdout) as ExifToolResult[])[0];
  const longitude = first?.GPSLongitude;
  const latitude = first?.GPSLatitude;
  const hasCoordinate = validPhotoCoordinate(longitude, latitude);
  const capturedAt = optionalMetadataText(first?.DateTimeOriginal);
  const manufacturer = optionalMetadataText(first?.Make);
  const cameraModel = optionalMetadataText(first?.Model);
  const iso = optionalPositiveNumber(first?.ISO);
  const fStop = optionalPositiveNumber(first?.FNumber);
  const shutterSpeed = optionalPositiveNumber(first?.ExposureTime);
  const caption = optionalMetadataText(first?.["Caption-Abstract"]);
  return {
    longitude: hasCoordinate ? longitude : null,
    latitude: hasCoordinate ? (latitude as number) : null,
    metadata: {
      capturedAt: capturedAt ?? null,
      ...(manufacturer === undefined ? {} : { manufacturer }),
      ...(cameraModel === undefined ? {} : { cameraModel }),
      ...(iso === undefined ? {} : { iso }),
      ...(fStop === undefined ? {} : { fStop }),
      ...(shutterSpeed === undefined ? {} : { shutterSpeed }),
      ...(caption === undefined ? {} : { iptc: { caption } }),
    },
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
  const photoMetadata = Object.fromEntries(
    Object.entries(asset.metadata).filter(
      ([key, value]) =>
        key !== "orientation" && key !== "pages" && value !== null,
    ),
  );
  return {
    ...result,
    ...(asset.kind === "external-photo" && Object.keys(photoMetadata).length > 0
      ? { photoMetadata }
      : {}),
  } as LayerAsset;
}

export class PhotoScanService {
  private activeRun: Promise<void> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
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
    private readonly jobPolicy: {
      retentionDays: number;
      errorHistoryLimit: number;
    },
  ) {}

  async initialize(): Promise<void> {
    await this.previews.initialize();
    this.jobs.recoverInterrupted();
    this.cleanupJobs();
    this.cleanupTimer = setInterval(() => this.cleanupJobs(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
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

  listJobErrors(id: string): JobError[] {
    this.getJob(id);
    return this.jobs.listErrors(id);
  }

  cleanupJobs(referenceTime = new Date()): JobCleanupResponse {
    const cutoff = new Date(
      referenceTime.getTime() - this.jobPolicy.retentionDays * 86_400_000,
    ).toISOString();
    return { deletedJobs: this.jobs.deleteExpired(cutoff), cutoff };
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

  assetExtent(layerId: string): LayerAssetExtent {
    this.layers.get(layerId);
    return this.layerRepository.externalPhotoExtent(layerId);
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
    if ((patch.longitude === null) !== (patch.latitude === null)) {
      throw new JobStateError(
        "Use a complete point coordinate or leave it empty.",
      );
    }
    const updated: StoredLayerAsset = {
      ...asset,
      longitude: patch.longitude,
      latitude: patch.latitude,
      coordinateSource: hasCoordinate ? "manual" : "none",
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
        withoutLocation: 0,
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
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
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
      const progressCursor = this.jobs.progressCursor(job.id);
      const remainingFiles =
        progressCursor === null
          ? files
          : files.filter(
              (file) => file.relativePath.localeCompare(progressCursor) > 0,
            );
      const processedFiles = job.completed + job.skipped + job.failed;
      job = {
        ...job,
        total: processedFiles + remainingFiles.length,
        updatedAt: new Date().toISOString(),
      };
      this.jobs.update(job);
      const existing = this.layerRepository.listExternalPhotos(input.layerId);
      const seen = new Set(files.map((file) => file.relativePath));
      for (
        let batchStart = 0;
        batchStart < remainingFiles.length;
        batchStart += this.limits.batchSize
      ) {
        const batch = remainingFiles.slice(
          batchStart,
          batchStart + this.limits.batchSize,
        );
        for (
          let chunkStart = 0;
          chunkStart < batch.length;
          chunkStart += this.limits.decoderConcurrency
        ) {
          if (this.stopRequested(job.id)) {
            return;
          }
          const chunk = batch.slice(
            chunkStart,
            chunkStart + this.limits.decoderConcurrency,
          );
          const results = await Promise.all(
            chunk.map(async (file) => {
              const previous = this.layerRepository.getExternalPhoto(
                input.layerId,
                file.relativePath,
              );
              return this.processFile(job.id, input.layerId, file, previous);
            }),
          );
          const progress = results.reduce(
            (counts, result) => ({
              created: counts.created + (result === "created" ? 1 : 0),
              changed: counts.changed + (result === "changed" ? 1 : 0),
              unchanged: counts.unchanged + (result === "unchanged" ? 1 : 0),
              withoutLocation:
                counts.withoutLocation +
                (result === "without-location" ? 1 : 0),
              failed: counts.failed + (result === "failed" ? 1 : 0),
            }),
            {
              created: 0,
              changed: 0,
              unchanged: 0,
              withoutLocation: 0,
              failed: 0,
            },
          );
          const latest = this.getJob(job.id);
          const nextProcessedFiles =
            latest.completed +
            latest.skipped +
            latest.failed +
            progress.created +
            progress.changed +
            progress.unchanged +
            progress.withoutLocation +
            progress.failed;
          if (nextProcessedFiles > latest.total) {
            throw new Error(
              "Photo scan progress exceeds the discovered total.",
            );
          }
          job = {
            ...latest,
            completed: latest.completed + progress.created + progress.changed,
            skipped:
              latest.skipped + progress.unchanged + progress.withoutLocation,
            failed: latest.failed + progress.failed,
            summary: {
              ...latest.summary,
              created: (latest.summary.created ?? 0) + progress.created,
              changed: (latest.summary.changed ?? 0) + progress.changed,
              unchanged: (latest.summary.unchanged ?? 0) + progress.unchanged,
              withoutLocation:
                (latest.summary.withoutLocation ?? 0) +
                progress.withoutLocation,
              failed: (latest.summary.failed ?? 0) + progress.failed,
            },
            updatedAt: new Date().toISOString(),
          };
          const lastProcessedPath = chunk.at(-1)?.relativePath;
          if (lastProcessedPath === undefined) {
            throw new Error(
              "Photo scan progress cannot checkpoint an empty chunk.",
            );
          }
          this.jobs.updateProgress(job, lastProcessedPath);
        }
      }
      if (this.stopRequested(job.id)) {
        return;
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
          !seen.has(asset.relativePath)
        ) {
          missing += 1;
          if (asset.status !== "missing") {
            this.layerRepository.upsertAsset({
              ...asset,
              status: "missing",
              errorCode: "PHOTO_SOURCE_MISSING",
              errorMessage: "The external photo file is no longer available.",
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      const finishedAt = new Date().toISOString();
      const latest = this.getJob(job.id);
      this.jobs.update({
        ...latest,
        status: "completed",
        summary: {
          ...latest.summary,
          missing,
        },
        updatedAt: finishedAt,
        finishedAt,
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const message =
        error instanceof Error ? error.message : "The photo scan failed.";
      this.jobs.addError(
        job.id,
        {
          code: "PHOTO_SCAN_FAILED",
          message,
          item: null,
          createdAt: timestamp,
        },
        this.jobPolicy.errorHistoryLimit,
      );
      this.jobs.update({
        ...this.getJob(job.id),
        status: "failed",
        lastError: message,
        updatedAt: timestamp,
        finishedAt: timestamp,
      });
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

  private async processFile(
    jobId: string,
    layerId: string,
    file: ResolvedPhotoFile,
    previous: StoredLayerAsset | undefined,
  ): Promise<
    "created" | "changed" | "unchanged" | "without-location" | "failed"
  > {
    const timestamp = new Date().toISOString();
    const assetId = previous?.id ?? randomUUID();
    let persistFailure = previous !== undefined;
    let effectiveLongitude = previous?.longitude ?? null;
    let effectiveLatitude = previous?.latitude ?? null;
    let effectiveCoordinateSource = previous?.coordinateSource ?? "none";
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
      const exif = await readExif(file.absolutePath);
      const preserveCoordinate =
        previous !== undefined && previous.coordinateSource !== "exif";
      const hasExifCoordinate =
        exif.longitude !== null && exif.latitude !== null;
      persistFailure ||= hasExifCoordinate;
      if (previous === undefined && !hasExifCoordinate) {
        return "without-location";
      }
      effectiveLongitude = preserveCoordinate
        ? (previous?.longitude ?? null)
        : exif.longitude;
      effectiveLatitude = preserveCoordinate
        ? (previous?.latitude ?? null)
        : exif.latitude;
      effectiveCoordinateSource = preserveCoordinate
        ? (previous?.coordinateSource ?? "none")
        : hasExifCoordinate
          ? "exif"
          : "none";
      const processed = await this.previews.process(assetId, file.absolutePath);
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
        longitude: effectiveLongitude,
        latitude: effectiveLatitude,
        coordinateSource: effectiveCoordinateSource,
        previewAvailable: true,
        errorCode: null,
        errorMessage: null,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        managedPath: null,
        previewPath: processed.previewPath,
        sourceFingerprint: processed.sourceFingerprint,
        metadata: {
          ...processed.metadata,
          ...exif.metadata,
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
      const message = (
        error instanceof Error ? error.message : "Photo processing failed."
      ).replaceAll(file.absolutePath, file.relativePath);
      if (persistFailure) {
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
          longitude: effectiveLongitude,
          latitude: effectiveLatitude,
          coordinateSource: effectiveCoordinateSource,
          previewAvailable: previous?.previewAvailable ?? false,
          errorCode: "PHOTO_PROCESSING_FAILED",
          errorMessage: message,
          createdAt: previous?.createdAt ?? timestamp,
          updatedAt: timestamp,
          managedPath: null,
          previewPath: previous?.previewPath ?? null,
          sourceFingerprint: previous?.sourceFingerprint ?? null,
          metadata: previous?.metadata ?? {},
        });
      }
      this.jobs.addError(
        jobId,
        {
          code: "PHOTO_PROCESSING_FAILED",
          message,
          item: file.relativePath,
          createdAt: timestamp,
        },
        this.jobPolicy.errorHistoryLimit,
      );
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
