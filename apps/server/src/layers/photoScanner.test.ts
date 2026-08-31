import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Job, Layer } from "@maptoy/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type MaptoyDatabase } from "../database.js";
import type { ImagePreviewStorage } from "./imagePreviewStorage.js";
import type { PhotoDirectory, ResolvedPhotoFile } from "./photoDirectory.js";
import { PhotoScanService } from "./photoScanner.js";
import {
  JobRepository,
  LayerRepository,
  type StoredLayerAsset,
} from "./repository.js";
import type { LayerService } from "./service.js";

const temporaryDirectories: string[] = [];
const layerId = "00000000-0000-4000-8000-000000000101";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function photoLayer(): Layer {
  const timestamp = "2026-08-31T00:00:00.000Z";
  return {
    id: layerId,
    name: "Recovery photos",
    pluginId: "photo-layer",
    pluginVersion: "0.2.0",
    schemaVersion: 1,
    configuration: {},
    data: {},
    visible: true,
    displayOrder: 0,
    opacity: 1,
    minimumZoom: null,
    maximumZoom: null,
    status: "ready",
    diagnostic: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function existingPhoto(relativePath: string): StoredLayerAsset {
  const timestamp = "2026-08-31T00:00:00.000Z";
  return {
    id: `asset-${relativePath}`,
    layerId,
    kind: "external-photo",
    status: "ready",
    fileName: relativePath,
    contentType: "image/jpeg",
    byteLength: 100,
    contentHash: `hash-${relativePath}`,
    sourceRootId: "photos",
    relativePath,
    sourceModifiedAt: timestamp,
    width: 10,
    height: 10,
    longitude: null,
    latitude: null,
    coordinateSource: "none",
    bounds: null,
    previewAvailable: true,
    errorCode: null,
    errorMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    managedPath: null,
    previewPath: `layer-previews/${relativePath}.webp`,
    sourceFingerprint: `fingerprint-${relativePath}`,
    metadata: {},
  };
}

interface FingerprintController {
  fingerprint: ImagePreviewStorage["fingerprint"];
  calls: string[];
  releaseNext: () => Promise<void>;
}

function controlledFingerprints(): FingerprintController {
  const pending: Array<() => void> = [];
  const calls: string[] = [];
  return {
    calls,
    fingerprint: async (absolutePath) => {
      const relativePath = path.basename(absolutePath);
      calls.push(relativePath);
      await new Promise<void>((resolve) => pending.push(resolve));
      return {
        byteLength: 100,
        sourceModifiedAt: "2026-08-31T00:00:00.000Z",
        sourceFingerprint: `fingerprint-${relativePath}`,
      };
    },
    releaseNext: async () => {
      await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
      pending.shift()?.();
    },
  };
}

async function createHarness(relativePaths: string[]): Promise<{
  database: MaptoyDatabase;
  jobs: JobRepository;
  service: PhotoScanService;
  fingerprints: FingerprintController;
}> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "maptoy-photo-job-test-"),
  );
  temporaryDirectories.push(directory);
  const database = await openDatabase(path.join(directory, "maptoy.sqlite"));
  const layers = new LayerRepository(database.sqlite);
  const jobs = new JobRepository(database.sqlite);
  const layer = photoLayer();
  layers.insert(layer);
  for (const relativePath of relativePaths) {
    layers.upsertAsset(existingPhoto(relativePath));
  }
  const fingerprints = controlledFingerprints();
  const files: ResolvedPhotoFile[] = relativePaths.map((relativePath) => ({
    absolutePath: path.join("/photos", relativePath),
    relativePath,
  }));
  const photoDirectory = {
    files: async () => files,
    status: async () => ({ configured: true, available: true }),
  } as unknown as PhotoDirectory;
  const previews = {
    initialize: async () => undefined,
    fingerprint: fingerprints.fingerprint,
  } as unknown as ImagePreviewStorage;
  const layerService = {
    get: (requestedId: string) => {
      if (requestedId !== layer.id) {
        throw new Error("Unexpected Layer ID.");
      }
      return layer;
    },
  } as unknown as LayerService;
  const service = new PhotoScanService(
    layerService,
    layers,
    jobs,
    photoDirectory,
    previews,
    { batchSize: 1, decoderConcurrency: 1, maximumFiles: 100 },
    { retentionDays: 30, errorHistoryLimit: 2 },
  );
  return { database, jobs, service, fingerprints };
}

async function finishHarness(
  service: PhotoScanService,
  database: MaptoyDatabase,
): Promise<void> {
  await service.shutdown();
  database.close();
}

describe("PhotoScanService Job progress", () => {
  it("continues after pause without counting checkpointed photos twice", async () => {
    const harness = await createHarness(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
    await harness.service.initialize();
    const started = harness.service.start(layerId, {
      relativeDirectory: "",
      recursive: true,
    });

    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(started.id).skipped).toBe(1),
    );
    harness.service.pause(started.id);
    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(started.id)).toMatchObject({
        status: "paused",
        skipped: 2,
      }),
    );

    harness.service.resume(started.id);
    await harness.fingerprints.releaseNext();
    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(started.id)).toMatchObject({
        status: "completed",
        total: 4,
        completed: 0,
        skipped: 4,
        failed: 0,
        summary: { unchanged: 4 },
      }),
    );
    expect(harness.fingerprints.calls).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
      "d.jpg",
    ]);

    await finishHarness(harness.service, harness.database);
  });

  it("keeps cancelled progress bounded and does not start another photo", async () => {
    const harness = await createHarness(["a.jpg", "b.jpg", "c.jpg"]);
    await harness.service.initialize();
    const started = harness.service.start(layerId, {
      relativeDirectory: "",
      recursive: true,
    });

    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(started.id).skipped).toBe(1),
    );
    harness.service.cancel(started.id);
    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(started.id).skipped).toBe(2),
    );
    const cancelled = harness.service.getJob(started.id);
    expect(cancelled.status).toBe("cancelled");
    expect(
      cancelled.completed + cancelled.skipped + cancelled.failed,
    ).toBeLessThanOrEqual(cancelled.total);
    expect(harness.fingerprints.calls).toEqual(["a.jpg", "b.jpg"]);

    await finishHarness(harness.service, harness.database);
  });

  it("recovers a running Job from its durable cursor", async () => {
    const harness = await createHarness(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
    const timestamp = "2026-08-31T00:00:00.000Z";
    const interrupted: Job = {
      id: "00000000-0000-4000-8000-000000000102",
      type: "photo-scan",
      status: "running",
      input: { layerId, relativeDirectory: "", recursive: true },
      total: 4,
      completed: 0,
      skipped: 2,
      failed: 0,
      summary: { created: 0, changed: 0, unchanged: 2, missing: 0, failed: 0 },
      lastError: null,
      createdAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp,
      finishedAt: null,
    };
    harness.jobs.insert(interrupted);
    harness.jobs.updateProgress(interrupted, "b.jpg");

    await harness.service.initialize();
    await harness.fingerprints.releaseNext();
    await harness.fingerprints.releaseNext();
    await vi.waitFor(() =>
      expect(harness.service.getJob(interrupted.id)).toMatchObject({
        status: "completed",
        total: 4,
        skipped: 4,
        summary: { unchanged: 4 },
      }),
    );
    expect(harness.fingerprints.calls).toEqual(["c.jpg", "d.jpg"]);

    await finishHarness(harness.service, harness.database);
  });
});

describe("JobRepository lifecycle", () => {
  it("bounds error history and only removes expired terminal Jobs", async () => {
    const harness = await createHarness([]);
    const oldTimestamp = "2026-01-01T00:00:00.000Z";
    const recentTimestamp = "2026-09-01T00:00:00.000Z";
    const insertJob = (
      id: string,
      status: Job["status"],
      finishedAt: string | null,
    ): void => {
      harness.jobs.insert({
        id,
        type: "photo-scan",
        status,
        input: { layerId, relativeDirectory: "", recursive: true },
        total: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
        summary: {},
        lastError: null,
        createdAt: oldTimestamp,
        startedAt: oldTimestamp,
        updatedAt: finishedAt ?? oldTimestamp,
        finishedAt,
      });
    };
    insertJob("expired-completed", "completed", oldTimestamp);
    insertJob("expired-failed", "failed", oldTimestamp);
    insertJob("expired-cancelled", "cancelled", oldTimestamp);
    insertJob("protected-running", "running", oldTimestamp);
    insertJob("protected-paused", "paused", oldTimestamp);
    insertJob("protected-queued", "queued", oldTimestamp);
    insertJob("recent-completed", "completed", recentTimestamp);

    for (const [index, message] of ["first", "second", "third"].entries()) {
      harness.jobs.addError(
        "expired-failed",
        {
          code: "PHOTO_PROCESSING_FAILED",
          message,
          item: `${message}.jpg`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        },
        2,
      );
    }
    expect(harness.jobs.listErrors("expired-failed")).toMatchObject([
      { message: "third", item: "third.jpg" },
      { message: "second", item: "second.jpg" },
    ]);

    expect(harness.jobs.deleteExpired("2026-08-31T00:00:00.000Z")).toBe(3);
    expect(
      harness.jobs
        .list()
        .map(({ id }) => id)
        .sort(),
    ).toEqual([
      "protected-paused",
      "protected-queued",
      "protected-running",
      "recent-completed",
    ]);
    expect(harness.jobs.listErrors("expired-failed")).toEqual([]);

    await finishHarness(harness.service, harness.database);
  });

  it("runs configured retention automatically during service startup", async () => {
    const harness = await createHarness([]);
    const timestamp = "2000-01-01T00:00:00.000Z";
    harness.jobs.insert({
      id: "expired-at-startup",
      type: "photo-scan",
      status: "completed",
      input: { layerId, relativeDirectory: "", recursive: true },
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      summary: {},
      lastError: null,
      createdAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp,
      finishedAt: timestamp,
    });

    await harness.service.initialize();
    expect(harness.jobs.get("expired-at-startup")).toBeUndefined();

    await finishHarness(harness.service, harness.database);
  });
});
