import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDefaultMapSetInput, type MapSet } from "@maptoy/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type MaptoyDatabase } from "../database.js";
import { MapSetRepository } from "../mapSets/repository.js";
import type { ProviderResponse } from "../providerClient.js";
import { TileArchiveRepository } from "./repository.js";
import { TileArchiveError, TileArchiveService } from "./service.js";
import { TileStorage } from "./storage.js";

const temporaryDirectories: string[] = [];
const databases: MaptoyDatabase[] = [];
const pngVariants = [
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUBAQHIpFY6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUCAgJ4xuoaAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUDAwMXGIH6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUEBATDcpQbAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
].map((value) => Buffer.from(value, "base64"));
const wrongSizePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACAAQMAAAD58POIAAAAA1BMVEUBAQHIpFY6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVRIx2NgGAWjYBSMglEwCkbBKKAvAAAIgAABbisdVAAAAABJRU5ErkJggg==",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAEAAQADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9k=",
  "base64",
);

function png(label: string): Buffer {
  const index = [...label].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return pngVariants[index % pngVariants.length] ?? pngVariants[0];
}

function response(
  body: Buffer,
  headers: Record<string, string> = {},
): ProviderResponse {
  return {
    statusCode: 200,
    headers: { "content-type": "image/png", ...headers },
    body,
  };
}

async function fixture(clock: () => Date): Promise<{
  mapSet: MapSet;
  repository: TileArchiveRepository;
  service: TileArchiveService;
  storage: TileStorage;
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "maptoy-tiles-test-"));
  temporaryDirectories.push(directory);
  const database = await openDatabase(path.join(directory, "maptoy.sqlite"));
  databases.push(database);
  const timestamp = clock().toISOString();
  const mapSet: MapSet = {
    ...createDefaultMapSetInput(),
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    cachePolicy: {
      enabled: true,
      maximumAgeSeconds: 10,
      maximumStorageBytes: null,
    },
  };
  new MapSetRepository(database.sqlite).insert(mapSet);
  const repository = new TileArchiveRepository(database.sqlite);
  const storage = new TileStorage(directory);
  const service = new TileArchiveService(repository, storage, clock);
  await service.initialize();
  return { mapSet, repository, service, storage };
}

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
  }
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("TileArchiveService", () => {
  it("seeds immutable upload revisions and serves them without a provider request", async () => {
    let now = new Date("2026-08-24T08:00:00.000Z");
    const { mapSet, repository, service } = await fixture(() => now);
    const tile = { zoom: 3, x: 4, y: 2 };
    const bodyA = png("upload-a");
    const bodyB = png("upload-b");

    const first = await service.upload(mapSet, tile, {
      body: bodyA,
      contentType: "image/png",
      maximumTileBytes: 1024,
    });
    expect(first.created).toBe(true);
    expect(repository.revisionById(first.revisionId)).toMatchObject({
      origin: "upload",
      etag: null,
      lastModified: null,
    });

    const requestProvider = vi.fn(async () => response(png("provider")));
    expect(
      (
        await service.tile(
          mapSet,
          tile,
          { refresh: "auto", selection: { kind: "current" } },
          requestProvider,
        )
      ).body,
    ).toEqual(bodyA);
    expect(
      (
        await service.tile(
          mapSet,
          tile,
          { refresh: "cache-only", selection: { kind: "current" } },
          requestProvider,
        )
      ).body,
    ).toEqual(bodyA);
    expect(requestProvider).not.toHaveBeenCalled();

    now = new Date("2026-08-24T08:00:01.000Z");
    const identical = await service.upload(mapSet, tile, {
      body: bodyA,
      contentType: "image/png; charset=binary",
      maximumTileBytes: 1024,
    });
    expect(identical).toEqual({ revisionId: first.revisionId, created: false });
    expect(repository.revisionById(first.revisionId)).toMatchObject({
      firstSeenAt: "2026-08-24T08:00:00.000Z",
      lastSeenAt: "2026-08-24T08:00:01.000Z",
      origin: "upload",
    });

    now = new Date("2026-08-24T08:00:02.000Z");
    const second = await service.upload(mapSet, tile, {
      body: bodyB,
      contentType: "image/png",
      maximumTileBytes: 1024,
    });
    now = new Date("2026-08-24T08:00:03.000Z");
    const third = await service.upload(mapSet, tile, {
      body: bodyA,
      contentType: "image/png",
      maximumTileBytes: 1024,
    });
    expect(second.created).toBe(true);
    expect(third.created).toBe(true);
    const revisions = service.listRevisions(mapSet.id);
    expect(revisions).toHaveLength(3);
    expect(revisions.every(({ origin }) => origin === "upload")).toBe(true);
    expect(repository.revisionById(first.revisionId)?.filePath).toBe(
      repository.revisionById(third.revisionId)?.filePath,
    );
    expect(service.stats(mapSet.id)).toMatchObject({
      totalRevisionCount: 3,
      uniqueContentCount: 2,
      totalStorageBytes: bodyA.byteLength + bodyB.byteLength,
    });
  });

  it("serializes provider writes and uploads for the same logical tile", async () => {
    const now = new Date("2026-08-24T09:00:00.000Z");
    const { mapSet, service } = await fixture(() => now);
    const tile = { zoom: 3, x: 4, y: 2 };
    let resolveProvider: ((value: ProviderResponse) => void) | undefined;
    const provider = service.tile(
      mapSet,
      tile,
      { refresh: "force", selection: { kind: "current" } },
      () =>
        new Promise<ProviderResponse>((resolve) => {
          resolveProvider = resolve;
        }),
    );
    const upload = service.upload(mapSet, tile, {
      body: png("upload-after-provider"),
      contentType: "image/png",
      maximumTileBytes: 1024,
    });

    resolveProvider?.(response(png("provider-first")));
    await provider;
    const uploaded = await upload;

    expect(uploaded.created).toBe(true);
    expect(service.listRevisions(mapSet.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origin: "upload", current: true }),
        expect.objectContaining({ origin: "provider", current: false }),
      ]),
    );
  });

  it("rejects upload policy, media, content, body, and storage violations without metadata", async () => {
    const now = new Date("2026-08-24T10:00:00.000Z");
    const { mapSet, service, storage } = await fixture(() => now);
    const tile = { zoom: 2, x: 2, y: 1 };

    await expect(
      service.upload(mapSet, tile, {
        body: png("wrong-media"),
        contentType: "image/jpeg",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({
      code: "TILE_MEDIA_TYPE_INVALID",
      statusCode: 415,
    });
    await expect(
      service.upload(mapSet, tile, {
        body: Buffer.from("not-a-png"),
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_CONTENT_INVALID", statusCode: 400 });
    await expect(
      service.upload(mapSet, tile, {
        body: jpeg,
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_CONTENT_INVALID", statusCode: 400 });
    await expect(
      service.upload(mapSet, tile, {
        body: wrongSizePng,
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_CONTENT_INVALID", statusCode: 400 });
    await expect(
      service.upload(mapSet, tile, {
        body: png("corrupt").subarray(0, 80),
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_CONTENT_INVALID", statusCode: 400 });
    await expect(
      service.upload(mapSet, tile, {
        body: png("too-large"),
        contentType: "image/png",
        maximumTileBytes: 1,
      }),
    ).rejects.toMatchObject({ code: "TILE_BODY_TOO_LARGE", statusCode: 413 });

    mapSet.cachePolicy.maximumStorageBytes = 1;
    await expect(
      service.upload(mapSet, tile, {
        body: png("no-space"),
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_STORAGE_LIMIT", statusCode: 507 });
    mapSet.cachePolicy.enabled = false;
    await expect(
      service.upload(mapSet, tile, {
        body: png("disabled"),
        contentType: "image/png",
        maximumTileBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "TILE_ARCHIVE_DISABLED", statusCode: 409 });

    expect(service.stats(mapSet.id)).toMatchObject({
      logicalTileCount: 0,
      totalRevisionCount: 0,
      totalStorageBytes: 0,
    });
    expect(await storage.listMapSetFiles(mapSet.id)).toEqual([]);
  });

  it("preserves revisions, reuses content, validates conditionally, and serves selections", async () => {
    let now = new Date("2026-08-21T10:00:00.000Z");
    const { mapSet, repository, service, storage } = await fixture(() => now);
    const tile = { zoom: 3, x: 4, y: 2 };
    const bodyA = png("A");
    const bodyB = png("B");
    const responses: ProviderResponse[] = [
      response(bodyA, { etag: '"a"' }),
      { statusCode: 304, headers: { etag: '"a"' }, body: Buffer.alloc(0) },
      response(bodyA, { etag: '"a2"' }),
      response(bodyB, { etag: '"b"' }),
      response(bodyA, { etag: '"a3"' }),
      response(bodyA, { etag: '"a4"' }),
    ];
    const requestProvider = vi.fn(
      async (_headers: Readonly<Record<string, string>>) => {
        const next = responses.shift();
        if (next === undefined) {
          throw new Error("Unexpected provider request.");
        }
        return next;
      },
    );

    const first = await service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    expect(first.cacheStatus).toBe("miss");
    expect(first.body).toEqual(bodyA);
    expect(requestProvider).toHaveBeenCalledTimes(1);

    const hit = await service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    expect(hit.cacheStatus).toBe("hit");
    expect(requestProvider).toHaveBeenCalledTimes(1);

    const snapshot = service.createSnapshot(mapSet.id, "initial");
    expect(snapshot.tileCount).toBe(1);
    now = new Date("2026-08-21T10:00:20.000Z");
    const validated = await service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    expect(validated.cacheStatus).toBe("validated");
    expect(requestProvider.mock.calls[1]?.[0]).toEqual({
      "If-None-Match": '"a"',
    });
    expect(service.listRevisions(mapSet.id)).toHaveLength(1);

    now = new Date("2026-08-21T10:00:25.000Z");
    await service.tile(
      mapSet,
      tile,
      { refresh: "force", selection: { kind: "current" } },
      requestProvider,
    );
    expect(service.listRevisions(mapSet.id)).toHaveLength(1);

    now = new Date("2026-08-21T10:00:30.000Z");
    const changed = await service.tile(
      mapSet,
      tile,
      { refresh: "force", selection: { kind: "current" } },
      requestProvider,
    );
    expect(changed.body).toEqual(bodyB);
    const afterChange = service.listRevisions(mapSet.id);
    expect(afterChange).toHaveLength(2);
    expect(
      service.compare(mapSet.id, `snapshot:${snapshot.id}`, "current"),
    ).toMatchObject({ identical: 0, changed: 1, added: 0, missing: 0 });

    const fromSnapshot = await service.tile(
      mapSet,
      tile,
      {
        refresh: "cache-only",
        selection: { kind: "snapshot", snapshotId: snapshot.id },
      },
      requestProvider,
    );
    expect(fromSnapshot.body).toEqual(bodyA);
    const asOf = await service.tile(
      mapSet,
      tile,
      {
        refresh: "cache-only",
        selection: {
          kind: "as-of",
          timestamp: "2026-08-21T10:00:25.000Z",
        },
      },
      requestProvider,
    );
    expect(asOf.body).toEqual(bodyA);
    const explicit = await service.tile(
      mapSet,
      tile,
      {
        refresh: "cache-only",
        selection: { kind: "revision", revisionId: first.revisionId ?? "" },
      },
      requestProvider,
    );
    expect(explicit.body).toEqual(bodyA);

    now = new Date("2026-08-21T10:00:40.000Z");
    await service.tile(
      mapSet,
      tile,
      { refresh: "force", selection: { kind: "current" } },
      requestProvider,
    );
    const revisions = service.listRevisions(mapSet.id);
    expect(revisions).toHaveLength(3);
    expect(revisions.filter(({ current }) => current)).toHaveLength(1);
    const firstPage = service.revisionPage(mapSet.id, {
      limit: 2,
      state: "all",
    });
    expect(firstPage).toMatchObject({ total: 3 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(
      service.revisionPage(mapSet.id, {
        limit: 2,
        cursor: Number(firstPage.nextCursor),
        state: "all",
      }),
    ).toMatchObject({ total: 3, nextCursor: null });
    expect(
      service.revisionPage(mapSet.id, { limit: 50, state: "current" }),
    ).toMatchObject({ total: 1, items: [{ current: true }] });
    expect(
      service.revisionPage(mapSet.id, { limit: 50, state: "historical" }),
    ).toMatchObject({ total: 2 });
    const firstStored = repository.revisionById(first.revisionId ?? "");
    const currentStored = repository.revisionById(
      revisions.find(({ current }) => current)?.id ?? "",
    );
    expect(firstStored?.contentHash).toBe(currentStored?.contentHash);
    expect(firstStored?.filePath).toBe(currentStored?.filePath);
    expect(await storage.exists(firstStored?.filePath ?? "missing")).toBe(true);

    await storage.writeAtomic(
      currentStored?.filePath ?? "missing",
      Buffer.from("corrupt"),
    );
    now = new Date("2026-08-21T10:00:41.000Z");
    const repaired = await service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    expect(repaired.body).toEqual(bodyA);
    expect(service.listRevisions(mapSet.id)).toHaveLength(3);

    await expect(
      service.deleteRevision(mapSet.id, currentStored?.id ?? ""),
    ).rejects.toMatchObject({ code: "TILE_REVISION_PROTECTED" });
    await expect(
      service.deleteRevision(mapSet.id, firstStored?.id ?? ""),
    ).rejects.toMatchObject({ code: "TILE_REVISION_PROTECTED" });
    const middle = revisions.find(
      ({ id }) => id !== firstStored?.id && id !== currentStored?.id,
    );
    await service.deleteRevision(mapSet.id, middle?.id ?? "");

    expect(await service.stats(mapSet.id)).toMatchObject({
      logicalTileCount: 1,
      totalRevisionCount: 2,
      historicalRevisionCount: 1,
      uniqueContentCount: 1,
      snapshotCount: 1,
      zoomLevels: [
        {
          zoom: 3,
          logicalTileCount: 1,
          totalRevisionCount: 2,
        },
      ],
    });
    expect(
      service.compare(mapSet.id, `snapshot:${snapshot.id}`, "current"),
    ).toMatchObject({ identical: 1, changed: 0, added: 0, missing: 0 });
  });

  it("deletes unsupported zoom Tiles while preserving snapshot selections", async () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    const { mapSet, service, storage } = await fixture(() => now);
    await service.upload(
      mapSet,
      { zoom: 3, x: 4, y: 2 },
      {
        body: png("snapshot-protected"),
        contentType: "image/png",
        maximumTileBytes: 1024,
      },
    );
    const snapshot = service.createSnapshot(mapSet.id, "protected");
    await service.upload(
      mapSet,
      { zoom: 4, x: 8, y: 5 },
      {
        body: png("deletable"),
        contentType: "image/png",
        maximumTileBytes: 1024,
      },
    );

    expect(service.unsupportedZoomInfo(mapSet.id, 5, 18)).toMatchObject({
      zoomLevels: [3, 4],
      logicalTileCount: 2,
      revisionCount: 2,
      deletableLogicalTileCount: 1,
      snapshotProtectedLogicalTileCount: 1,
    });

    const firstCleanup = await service.deleteUnsupportedZoomTiles(
      mapSet.id,
      5,
      18,
    );
    expect(firstCleanup).toMatchObject({
      removedLogicalTileCount: 1,
      removedRevisionCount: 1,
      removedFileCount: 1,
      remaining: {
        zoomLevels: [3],
        logicalTileCount: 1,
        deletableLogicalTileCount: 0,
        snapshotProtectedLogicalTileCount: 1,
      },
    });
    expect(service.listSnapshots(mapSet.id)).toEqual([snapshot]);
    expect(await storage.listMapSetFiles(mapSet.id)).toHaveLength(1);

    service.deleteSnapshot(mapSet.id, snapshot.id);
    const secondCleanup = await service.deleteUnsupportedZoomTiles(
      mapSet.id,
      5,
      18,
    );
    expect(secondCleanup).toMatchObject({
      removedLogicalTileCount: 1,
      removedRevisionCount: 1,
      removedFileCount: 1,
      remaining: { logicalTileCount: 0, zoomLevels: [] },
    });
    expect(await storage.listMapSetFiles(mapSet.id)).toEqual([]);
    expect(service.stats(mapSet.id).logicalTileCount).toBe(0);
  });

  it("deduplicates concurrent misses and never records invalid content", async () => {
    const now = new Date("2026-08-21T11:00:00.000Z");
    const { mapSet, repository, service, storage } = await fixture(() => now);
    const tile = { zoom: 4, x: 8, y: 5 };
    let resolveProvider: ((value: ProviderResponse) => void) | undefined;
    const requestProvider = vi.fn(
      () =>
        new Promise<ProviderResponse>((resolve) => {
          resolveProvider = resolve;
        }),
    );
    const first = service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    const second = service.tile(
      mapSet,
      tile,
      { refresh: "auto", selection: { kind: "current" } },
      requestProvider,
    );
    resolveProvider?.(response(png("shared")));
    expect((await first).body).toEqual((await second).body);
    expect(requestProvider).toHaveBeenCalledTimes(1);

    await expect(
      service.tile(
        mapSet,
        { zoom: 4, x: 9, y: 5 },
        { refresh: "force", selection: { kind: "current" } },
        async () => response(Buffer.from("not a png")),
      ),
    ).rejects.toBeInstanceOf(TileArchiveError);
    await expect(
      service.tile(
        mapSet,
        { zoom: 4, x: 10, y: 5 },
        { refresh: "force", selection: { kind: "current" } },
        async () => response(wrongSizePng),
      ),
    ).rejects.toMatchObject({ code: "TILE_CONTENT_INVALID", statusCode: 502 });
    expect(await service.stats(mapSet.id)).toMatchObject({
      logicalTileCount: 1,
      totalRevisionCount: 1,
    });

    const orphanPath = storage.relativeTilePath(
      mapSet.id,
      { zoom: 4, x: 10, y: 5 },
      "orphan",
      "png",
    );
    await storage.writeAtomic(orphanPath, Buffer.from("orphan"));
    const missingTile = await service.tile(
      mapSet,
      { zoom: 5, x: 12, y: 10 },
      { refresh: "auto", selection: { kind: "current" } },
      async () => response(png("missing")),
    );
    const snapshot = service.createSnapshot(mapSet.id, "before repair");
    const missingRevision = repository.revisionById(
      missingTile.revisionId ?? "",
    );
    await storage.delete(missingRevision?.filePath ?? "missing");
    expect(await service.audit(mapSet.id)).toMatchObject({
      orphanFileCount: 1,
      missingFileCount: 1,
    });
    expect(await service.repair(mapSet.id)).toMatchObject({
      removedOrphanFileCount: 1,
      removedOrphanBytes: 6,
      removedMissingFileCount: 1,
      removedMissingRevisionCount: 1,
      removedLogicalTileCount: 1,
      removedSnapshotReferenceCount: 1,
      audit: { missingFileCount: 0, orphanFileCount: 0 },
    });
    expect(await storage.exists(orphanPath)).toBe(false);
    expect(
      repository.revisionById(missingTile.revisionId ?? ""),
    ).toBeUndefined();
    expect(service.listSnapshots(mapSet.id)).toContainEqual({
      ...snapshot,
      tileCount: snapshot.tileCount - 1,
    });
    expect(await service.stats(mapSet.id)).toMatchObject({
      logicalTileCount: 1,
      totalRevisionCount: 1,
    });
    expect(await service.audit(mapSet.id)).toMatchObject({
      missingFileCount: 0,
      orphanFileCount: 0,
    });
  });

  it("reports cached Tile Revisions and blocks new bytes at the storage limit", async () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const { mapSet, service } = await fixture(() => now);
    expect(service.hasCachedTiles(mapSet.id)).toBe(false);
    mapSet.cachePolicy.maximumStorageBytes = 1;
    await expect(
      service.tile(
        mapSet,
        { zoom: 1, x: 1, y: 1 },
        { refresh: "force", selection: { kind: "current" } },
        async () => response(png("too-large")),
      ),
    ).rejects.toMatchObject({ code: "TILE_STORAGE_LIMIT" });
    expect(await service.stats(mapSet.id)).toMatchObject({
      totalRevisionCount: 0,
      totalStorageBytes: 0,
    });
    expect(service.hasCachedTiles(mapSet.id)).toBe(false);

    mapSet.cachePolicy.maximumStorageBytes = null;
    await service.tile(
      mapSet,
      { zoom: 1, x: 1, y: 1 },
      { refresh: "force", selection: { kind: "current" } },
      async () => response(png("stored")),
    );
    expect(service.hasCachedTiles(mapSet.id)).toBe(true);
  });
});
