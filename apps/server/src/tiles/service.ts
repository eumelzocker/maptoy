import { createHash } from "node:crypto";
import type {
  CacheSnapshot,
  MapSet,
  TileCacheAuditResult,
  TileCacheComparison,
  TileCacheRepairResult,
  TileCacheStats,
  TileRefreshMode,
  TileRevisionListResponse,
  TileRevisionSummary,
} from "@maptoy/contracts";
import type { ProviderResponse } from "../providerClient.js";
import type {
  StoredTileRevision,
  TileArchiveRepository,
  TileRevisionState,
  TileSelection,
} from "./repository.js";
import type { TileStorage } from "./storage.js";

export class TileArchiveError extends Error {
  constructor(
    readonly code:
      | "TILE_NOT_CACHED"
      | "TILE_CONTENT_INVALID"
      | "TILE_STORAGE_LIMIT"
      | "SNAPSHOT_NOT_FOUND"
      | "SNAPSHOT_NAME_CONFLICT"
      | "TILE_REVISION_NOT_FOUND"
      | "TILE_REVISION_PROTECTED",
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "TileArchiveError";
  }
}

export interface ArchivedTileResponse extends ProviderResponse {
  cacheStatus: "hit" | "miss" | "validated" | "bypass";
  revisionId: string | null;
}

type TileCoordinate = { zoom: number; x: number; y: number };
type ProviderRequest = (
  additionalHeaders: Readonly<Record<string, string>>,
) => Promise<ProviderResponse>;

function headerValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizedContentType(response: ProviderResponse): string | null {
  return (
    headerValue(response.headers["content-type"])
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? null
  );
}

function hasExpectedSignature(
  format: MapSet["tileFormat"],
  body: Buffer,
): boolean {
  if (format === "png") {
    return (
      body.length >= 8 &&
      body
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (format === "jpeg") {
    return (
      body.length >= 3 &&
      body[0] === 0xff &&
      body[1] === 0xd8 &&
      body[2] === 0xff
    );
  }
  return (
    body.length >= 12 &&
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function expectedContentType(format: MapSet["tileFormat"]): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function validateProviderTile(
  mapSet: MapSet,
  response: ProviderResponse,
): string {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new TileArchiveError(
      "TILE_CONTENT_INVALID",
      `The provider returned HTTP ${response.statusCode} for the requested tile.`,
      502,
    );
  }
  const contentType = normalizedContentType(response);
  const expected = expectedContentType(mapSet.tileFormat);
  if (
    contentType !== expected ||
    !hasExpectedSignature(mapSet.tileFormat, response.body)
  ) {
    throw new TileArchiveError(
      "TILE_CONTENT_INVALID",
      `The provider response is not a valid ${mapSet.tileFormat.toUpperCase()} tile.`,
      502,
    );
  }
  return contentType;
}

export class TileArchiveService {
  private readonly inFlight = new Map<string, Promise<ArchivedTileResponse>>();

  constructor(
    private readonly repository: TileArchiveRepository,
    private readonly storage: TileStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async tile(
    mapSet: MapSet,
    tile: TileCoordinate,
    options: { refresh: TileRefreshMode; selection: TileSelection },
    requestProvider: ProviderRequest,
  ): Promise<ArchivedTileResponse> {
    if (options.selection.kind !== "current") {
      return this.readSelected(mapSet.id, tile, options.selection);
    }

    const cached = this.repository.selectedRevision(mapSet.id, tile, {
      kind: "current",
    });
    if (options.refresh === "cache-only") {
      return cached === undefined
        ? Promise.reject(this.cacheMiss())
        : this.readRevision(cached, "hit");
    }
    if (!mapSet.cachePolicy.enabled || !mapSet.capabilities.tileArchive) {
      const response = await requestProvider({});
      validateProviderTile(mapSet, response);
      return { ...response, cacheStatus: "bypass", revisionId: null };
    }
    if (
      options.refresh === "auto" &&
      cached !== undefined &&
      this.isFresh(cached, mapSet.cachePolicy.maximumAgeSeconds) &&
      (await this.storage.exists(cached.filePath))
    ) {
      try {
        return await this.readRevision(cached, "hit");
      } catch (error) {
        if (
          !(error instanceof TileArchiveError) ||
          error.code !== "TILE_CONTENT_INVALID"
        ) {
          throw error;
        }
      }
    }

    const key = `${mapSet.id}/${tile.zoom}/${tile.x}/${tile.y}`;
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.fetchAndStore(
      mapSet,
      tile,
      cached,
      requestProvider,
    ).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  listRevisions(mapSetId: string): TileRevisionSummary[] {
    return this.repository.listRevisions(mapSetId);
  }

  revisionPage(
    mapSetId: string,
    options: {
      limit: number;
      cursor?: number;
      zoom?: number;
      state: TileRevisionState;
    },
  ): TileRevisionListResponse {
    return this.repository.pageRevisions(mapSetId, options);
  }

  createSnapshot(mapSetId: string, name: string): CacheSnapshot {
    const normalizedName = name.trim();
    if (normalizedName === "") {
      throw new TileArchiveError(
        "SNAPSHOT_NAME_CONFLICT",
        "A Cache Snapshot needs a name.",
        400,
      );
    }
    try {
      return this.repository.createSnapshot(
        mapSetId,
        normalizedName,
        this.clock().toISOString(),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        throw new TileArchiveError(
          "SNAPSHOT_NAME_CONFLICT",
          "A Cache Snapshot with this name already exists.",
          409,
        );
      }
      throw error;
    }
  }

  listSnapshots(mapSetId: string): CacheSnapshot[] {
    return this.repository.listSnapshots(mapSetId);
  }

  deleteSnapshot(mapSetId: string, snapshotId: string): void {
    if (!this.repository.deleteSnapshot(mapSetId, snapshotId)) {
      throw new TileArchiveError(
        "SNAPSHOT_NOT_FOUND",
        "The requested Cache Snapshot does not exist.",
        404,
      );
    }
  }

  stats(mapSetId: string): TileCacheStats {
    return this.repository.metadataStats(mapSetId);
  }

  logicalTileCounts(): ReadonlyMap<string, number> {
    return this.repository.logicalTileCounts();
  }

  hasCachedTiles(mapSetId: string): boolean {
    return this.repository.hasTileRevisions(mapSetId);
  }

  async audit(mapSetId: string): Promise<TileCacheAuditResult> {
    const { files, missingPaths, orphans } =
      await this.cacheInventory(mapSetId);
    return {
      scannedFileCount: files.length,
      physicalStorageBytes: files.reduce(
        (total, { byteLength }) => total + byteLength,
        0,
      ),
      missingFileCount: missingPaths.length,
      orphanFileCount: orphans.length,
    };
  }

  async repair(mapSetId: string): Promise<TileCacheRepairResult> {
    const { files, missingPaths, orphans } =
      await this.cacheInventory(mapSetId);
    const removedMetadata = this.repository.removeMissingFileReferences(
      mapSetId,
      missingPaths,
    );
    await Promise.all(
      orphans.map(({ filePath }) => this.storage.delete(filePath)),
    );
    const removedOrphanBytes = orphans.reduce(
      (total, { byteLength }) => total + byteLength,
      0,
    );
    return {
      scannedFileCount: files.length,
      removedOrphanFileCount: orphans.length,
      removedOrphanBytes,
      removedMissingFileCount: missingPaths.length,
      ...removedMetadata,
      audit: {
        scannedFileCount: files.length - orphans.length,
        physicalStorageBytes:
          files.reduce((total, { byteLength }) => total + byteLength, 0) -
          removedOrphanBytes,
        missingFileCount: 0,
        orphanFileCount: 0,
      },
    };
  }

  private async cacheInventory(mapSetId: string) {
    const referencedFiles = this.repository.referencedFiles(mapSetId);
    const physicalFiles = await this.storage.listMapSetFiles(mapSetId);
    const physicalPaths = new Set(
      physicalFiles.map(({ filePath }) => filePath),
    );
    const referencedPaths = new Set(
      referencedFiles.map(({ filePath }) => filePath),
    );
    const orphans = physicalFiles.filter(
      ({ filePath }) => !referencedPaths.has(filePath),
    );
    const missingPaths: string[] = [];
    for (const { filePath } of referencedFiles) {
      // Recheck after the directory scan so an in-flight Tile write is less likely
      // to have its freshly created database reference removed by repair.
      if (
        !physicalPaths.has(filePath) &&
        !(await this.storage.exists(filePath))
      ) {
        missingPaths.push(filePath);
      }
    }
    return {
      files: physicalFiles,
      missingPaths,
      orphans,
    };
  }

  compare(
    mapSetId: string,
    leftSelector: string,
    rightSelector: string,
  ): TileCacheComparison {
    const left = this.comparisonSelector(mapSetId, leftSelector);
    const right = this.comparisonSelector(mapSetId, rightSelector);
    return {
      left: leftSelector,
      right: rightSelector,
      ...this.repository.compareStates(mapSetId, left, right),
    };
  }

  async deleteRevision(mapSetId: string, revisionId: string): Promise<void> {
    const protection = this.repository.revisionProtection(mapSetId, revisionId);
    if (protection === undefined) {
      throw new TileArchiveError(
        "TILE_REVISION_NOT_FOUND",
        "The requested Tile Revision does not exist.",
        404,
      );
    }
    if (protection.current || protection.snapshotReferences > 0) {
      throw new TileArchiveError(
        "TILE_REVISION_PROTECTED",
        protection.current
          ? "The current Tile Revision cannot be deleted."
          : "A snapshot-referenced Tile Revision cannot be deleted.",
        409,
      );
    }
    const deletion = this.repository.deleteRevision(mapSetId, revisionId);
    if (deletion.remainingFileReferences === 0) {
      await this.storage.delete(deletion.filePath);
    }
  }

  deleteMapSetFiles(mapSetId: string): Promise<void> {
    return this.storage.deleteMapSet(mapSetId);
  }

  private async readSelected(
    mapSetId: string,
    tile: TileCoordinate,
    selection: TileSelection,
  ): Promise<ArchivedTileResponse> {
    const revision = this.repository.selectedRevision(
      mapSetId,
      tile,
      selection,
    );
    if (revision === undefined) {
      throw this.cacheMiss();
    }
    return this.readRevision(revision, "hit");
  }

  private async readRevision(
    revision: StoredTileRevision,
    cacheStatus: ArchivedTileResponse["cacheStatus"],
  ): Promise<ArchivedTileResponse> {
    try {
      const body = await this.storage.read(revision.filePath);
      const contentHash = createHash("sha256").update(body).digest("hex");
      if (contentHash !== revision.contentHash) {
        throw new TileArchiveError(
          "TILE_CONTENT_INVALID",
          "The stored Tile Revision does not match its content hash.",
          500,
        );
      }
      return {
        statusCode: 200,
        headers: { "content-type": revision.contentType },
        body,
        cacheStatus,
        revisionId: revision.id,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new TileArchiveError(
          "TILE_NOT_CACHED",
          "The Tile Revision metadata exists, but its content file is missing.",
          404,
        );
      }
      throw error;
    }
  }

  private async fetchAndStore(
    mapSet: MapSet,
    tile: TileCoordinate,
    cached: StoredTileRevision | undefined,
    requestProvider: ProviderRequest,
  ): Promise<ArchivedTileResponse> {
    const conditionalHeaders: Record<string, string> = {};
    if (cached?.etag !== null && cached?.etag !== undefined) {
      conditionalHeaders["If-None-Match"] = cached.etag;
    }
    if (cached?.lastModified !== null && cached?.lastModified !== undefined) {
      conditionalHeaders["If-Modified-Since"] = cached.lastModified;
    }
    const response = await requestProvider(conditionalHeaders);
    const timestamp = this.clock().toISOString();
    if (response.statusCode === 304) {
      if (cached === undefined) {
        throw new TileArchiveError(
          "TILE_CONTENT_INVALID",
          "The provider returned 304 without a cached Tile Revision.",
          502,
        );
      }
      const validated = this.repository.recordNotModified(
        cached.id,
        timestamp,
        {
          etag: headerValue(response.headers.etag),
          lastModified: headerValue(response.headers["last-modified"]),
        },
      );
      return this.readRevision(validated, "validated");
    }

    const contentType = validateProviderTile(mapSet, response);
    const contentHash = createHash("sha256")
      .update(response.body)
      .digest("hex");
    const filePath = this.storage.relativeTilePath(
      mapSet.id,
      tile,
      contentHash,
      mapSet.tileFormat,
    );
    const maximumStorageBytes = mapSet.cachePolicy.maximumStorageBytes;
    if (maximumStorageBytes !== null) {
      const files = await this.storage.listMapSetFiles(mapSet.id);
      const currentBytes = files.reduce(
        (total, file) => total + file.byteLength,
        0,
      );
      const replacedBytes =
        files.find((file) => file.filePath === filePath)?.byteLength ?? 0;
      if (
        currentBytes - replacedBytes + response.body.byteLength >
        maximumStorageBytes
      ) {
        throw new TileArchiveError(
          "TILE_STORAGE_LIMIT",
          "The configured Map Set storage limit would be exceeded.",
          507,
        );
      }
    }
    await this.storage.writeAtomic(filePath, response.body);
    const recorded = this.repository.recordContent({
      mapSetId: mapSet.id,
      tile,
      contentHash,
      filePath,
      contentType,
      byteLength: response.body.byteLength,
      etag: headerValue(response.headers.etag),
      lastModified: headerValue(response.headers["last-modified"]),
      timestamp,
    });
    return {
      ...response,
      cacheStatus: cached === undefined ? "miss" : "validated",
      revisionId: recorded.revision.id,
    };
  }

  private comparisonSelector(
    mapSetId: string,
    selector: string,
  ): "current" | { snapshotId: string } {
    if (selector === "current") {
      return "current";
    }
    if (selector.startsWith("snapshot:")) {
      const snapshotId = selector.slice("snapshot:".length);
      const snapshot = this.repository.snapshotById(snapshotId);
      if (snapshot?.mapSetId !== mapSetId) {
        throw new TileArchiveError(
          "SNAPSHOT_NOT_FOUND",
          "The requested Cache Snapshot does not exist.",
          404,
        );
      }
      return { snapshotId };
    }
    throw new TileArchiveError(
      "SNAPSHOT_NOT_FOUND",
      "Cache comparisons accept current or snapshot:<id> selectors.",
      400,
    );
  }

  private isFresh(
    revision: StoredTileRevision,
    maximumAgeSeconds: number,
  ): boolean {
    return (
      this.clock().getTime() - new Date(revision.lastValidatedAt).getTime() <=
      maximumAgeSeconds * 1000
    );
  }

  private cacheMiss(): TileArchiveError {
    return new TileArchiveError(
      "TILE_NOT_CACHED",
      "The requested tile is not available in the selected cache state.",
      404,
    );
  }
}
