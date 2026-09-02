import { createHash } from "node:crypto";
import type {
  CacheSnapshot,
  CoverageCell,
  CoverageQuery,
  CoverageResponse,
  CoverageSelection,
  MapSet,
  TileCacheAuditResult,
  TileCacheComparison,
  TileCacheMapSetAuditResult,
  TileCacheOverviewAuditResult,
  TileCacheOverviewStats,
  TileCacheRepairResult,
  TileCacheStats,
  TileCacheUnsupportedZoomCleanupResult,
  TileCacheUnsupportedZoomInfo,
  TileRefreshMode,
  TileRevisionListResponse,
  TileRevisionSummary,
  TileRevisionOrigin,
  TileUploadResponse,
} from "@maptoy/contracts";
import {
  type XyzTileRange,
  wgs84BoundsToXyzTileRanges,
  xyzTileBounds,
} from "@maptoy/map-core";
import sharp from "sharp";
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
      | "TILE_MEDIA_TYPE_INVALID"
      | "TILE_ARCHIVE_DISABLED"
      | "TILE_BODY_TOO_LARGE"
      | "TILE_STORAGE_LIMIT"
      | "SNAPSHOT_NOT_FOUND"
      | "SNAPSHOT_NAME_CONFLICT"
      | "TILE_REVISION_NOT_FOUND"
      | "TILE_REVISION_PROTECTED"
      | "COVERAGE_QUERY_INVALID",
    message: string,
    readonly statusCode: number,
    readonly providerStatusCode: number | null = null,
    readonly retryAfterMilliseconds: number | null = null,
  ) {
    super(message);
    this.name = "TileArchiveError";
  }
}

function retryAfterMilliseconds(
  value: string | string[] | undefined,
): number | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.ceil(seconds * 1000);
  const timestamp = new Date(text).getTime();
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
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
  return normalizeContentType(headerValue(response.headers["content-type"]));
}

function normalizeContentType(value: string | null | undefined): string | null {
  return value?.split(";", 1)[0]?.trim().toLowerCase() || null;
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

function invalidImageContent(
  mapSet: MapSet,
  source: "provider response" | "upload body",
  statusCode: 400 | 502,
): TileArchiveError {
  return new TileArchiveError(
    "TILE_CONTENT_INVALID",
    `The ${source} must be a decodable ${mapSet.tileFormat.toUpperCase()} image with dimensions ${mapSet.tileSize} x ${mapSet.tileSize} pixels.`,
    statusCode,
  );
}

async function validateImageContent(
  mapSet: MapSet,
  body: Buffer,
  source: "provider response" | "upload body",
  statusCode: 400 | 502,
): Promise<void> {
  if (!hasExpectedSignature(mapSet.tileFormat, body)) {
    throw invalidImageContent(mapSet, source, statusCode);
  }

  try {
    const image = sharp(body, {
      failOn: "error",
      limitInputPixels: mapSet.tileSize * mapSet.tileSize,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== mapSet.tileFormat ||
      metadata.width !== mapSet.tileSize ||
      metadata.height !== mapSet.tileSize ||
      (metadata.pages !== undefined && metadata.pages !== 1)
    ) {
      throw invalidImageContent(mapSet, source, statusCode);
    }
    await image.raw().toBuffer();
  } catch (error) {
    if (error instanceof TileArchiveError) {
      throw error;
    }
    throw invalidImageContent(mapSet, source, statusCode);
  }
}

async function validateProviderTile(
  mapSet: MapSet,
  response: ProviderResponse,
): Promise<string> {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new TileArchiveError(
      "TILE_CONTENT_INVALID",
      `The provider returned HTTP ${response.statusCode} for the requested tile.`,
      502,
      response.statusCode,
      response.statusCode === 429 || response.statusCode === 503
        ? retryAfterMilliseconds(response.headers["retry-after"])
        : null,
    );
  }
  const contentType = normalizedContentType(response);
  const expected = expectedContentType(mapSet.tileFormat);
  if (contentType !== expected) {
    throw new TileArchiveError(
      "TILE_CONTENT_INVALID",
      `The provider response is not a valid ${mapSet.tileFormat.toUpperCase()} tile.`,
      502,
    );
  }
  await validateImageContent(mapSet, response.body, "provider response", 502);
  return contentType;
}

export class TileArchiveService {
  private readonly providerRequests = new Map<
    string,
    Promise<ArchivedTileResponse>
  >();
  private readonly coordinateOperations = new Map<string, Promise<void>>();

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
      await validateProviderTile(mapSet, response);
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
    const existing = this.providerRequests.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.withCoordinateLock(key, async () => {
      const latest = this.repository.selectedRevision(mapSet.id, tile, {
        kind: "current",
      });
      if (
        options.refresh === "auto" &&
        latest !== undefined &&
        this.isFresh(latest, mapSet.cachePolicy.maximumAgeSeconds) &&
        (await this.storage.exists(latest.filePath))
      ) {
        try {
          return await this.readRevision(latest, "hit");
        } catch (error) {
          if (
            !(error instanceof TileArchiveError) ||
            error.code !== "TILE_CONTENT_INVALID"
          ) {
            throw error;
          }
        }
      }
      return this.fetchAndStore(mapSet, tile, latest, requestProvider);
    }).finally(() => this.providerRequests.delete(key));
    this.providerRequests.set(key, operation);
    return operation;
  }

  async upload(
    mapSet: MapSet,
    tile: TileCoordinate,
    input: {
      body: Buffer;
      contentType: string | undefined;
      maximumTileBytes: number;
    },
  ): Promise<TileUploadResponse> {
    if (!mapSet.cachePolicy.enabled || !mapSet.capabilities.tileArchive) {
      throw new TileArchiveError(
        "TILE_ARCHIVE_DISABLED",
        "Tile uploads require an enabled Tile Archive capability and cache policy.",
        409,
      );
    }
    const contentType = normalizeContentType(input.contentType);
    if (contentType !== expectedContentType(mapSet.tileFormat)) {
      throw new TileArchiveError(
        "TILE_MEDIA_TYPE_INVALID",
        `The upload Content-Type must be ${expectedContentType(mapSet.tileFormat)} for this Map Set.`,
        415,
      );
    }
    if (input.body.byteLength > input.maximumTileBytes) {
      throw new TileArchiveError(
        "TILE_BODY_TOO_LARGE",
        "The upload exceeds MAPTOY_TILES_MAX_BYTES.",
        413,
      );
    }
    await validateImageContent(mapSet, input.body, "upload body", 400);

    const key = this.coordinateKey(mapSet.id, tile);
    return this.withCoordinateLock(key, async () => {
      const recorded = await this.persistContent(mapSet, tile, {
        body: input.body,
        contentType,
        origin: "upload",
        etag: null,
        lastModified: null,
      });
      return {
        revisionId: recorded.revision.id,
        created: recorded.created,
      };
    });
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

  cacheState(
    mapSet: MapSet,
    tile: TileCoordinate,
  ): "fresh" | "stale" | "missing" {
    const revision = this.repository.selectedRevision(mapSet.id, tile, {
      kind: "current",
    });
    if (revision === undefined) return "missing";
    return this.isFresh(revision, mapSet.cachePolicy.maximumAgeSeconds)
      ? "fresh"
      : "stale";
  }

  downloadCacheSummary(
    mapSet: MapSet,
    ranges: ReadonlyArray<{ zoom: number; range: XyzTileRange }>,
    totalTiles: number,
  ): {
    freshTiles: number;
    staleTiles: number;
    missingTiles: number;
    averageCachedBytes: number | null;
  } {
    let freshTiles = 0;
    let staleTiles = 0;
    let cachedBytes = 0;
    for (const { zoom, range } of ranges) {
      for (const revision of this.repository.currentRevisionsInRange(
        mapSet.id,
        zoom,
        range,
      )) {
        cachedBytes += revision.byteLength;
        if (this.isFresh(revision, mapSet.cachePolicy.maximumAgeSeconds)) {
          freshTiles += 1;
        } else {
          staleTiles += 1;
        }
      }
    }
    const cachedTiles = freshTiles + staleTiles;
    return {
      freshTiles,
      staleTiles,
      missingTiles: Math.max(0, totalTiles - cachedTiles),
      averageCachedBytes:
        cachedTiles === 0 ? null : Math.ceil(cachedBytes / cachedTiles),
    };
  }

  overview(): TileCacheOverviewStats {
    return this.repository.metadataOverview();
  }

  unsupportedZoomInfo(
    mapSetId: string,
    minimumZoom: number,
    maximumZoom: number,
  ): TileCacheUnsupportedZoomInfo {
    return this.repository.unsupportedZoomInfo(
      mapSetId,
      minimumZoom,
      maximumZoom,
    );
  }

  async deleteUnsupportedZoomTiles(
    mapSetId: string,
    minimumZoom: number,
    maximumZoom: number,
  ): Promise<TileCacheUnsupportedZoomCleanupResult> {
    const deletion = this.repository.deleteUnsupportedZoomTiles(
      mapSetId,
      minimumZoom,
      maximumZoom,
    );
    for (const filePath of deletion.filePaths) {
      await this.storage.delete(filePath);
    }
    return {
      removedLogicalTileCount: deletion.removedLogicalTileCount,
      removedRevisionCount: deletion.removedRevisionCount,
      removedFileCount: deletion.filePaths.length,
      removedIndexedStorageBytes: deletion.removedIndexedStorageBytes,
      remaining: this.unsupportedZoomInfo(mapSetId, minimumZoom, maximumZoom),
    };
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

  async auditAll(
    mapSetIds: readonly string[],
  ): Promise<TileCacheOverviewAuditResult> {
    const mapSets: TileCacheMapSetAuditResult[] = [];
    for (const mapSetId of mapSetIds) {
      mapSets.push({ mapSetId, ...(await this.audit(mapSetId)) });
    }
    return {
      totals: mapSets.reduce(
        (totals, mapSet) => ({
          scannedFileCount: totals.scannedFileCount + mapSet.scannedFileCount,
          physicalStorageBytes:
            totals.physicalStorageBytes + mapSet.physicalStorageBytes,
          missingFileCount: totals.missingFileCount + mapSet.missingFileCount,
          orphanFileCount: totals.orphanFileCount + mapSet.orphanFileCount,
        }),
        {
          scannedFileCount: 0,
          physicalStorageBytes: 0,
          missingFileCount: 0,
          orphanFileCount: 0,
        },
      ),
      mapSets,
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

  coverage(mapSet: MapSet, query: CoverageQuery): CoverageResponse {
    if (query.zoom < mapSet.minZoom || query.zoom > mapSet.maxZoom) {
      throw new TileArchiveError(
        "COVERAGE_QUERY_INVALID",
        `Coverage zoom must be between ${mapSet.minZoom} and ${mapSet.maxZoom}.`,
        400,
      );
    }
    if (query.bounds.south >= query.bounds.north) {
      throw new TileArchiveError(
        "COVERAGE_QUERY_INVALID",
        "Coverage north must be greater than south.",
        400,
      );
    }
    if (query.bounds.west === query.bounds.east) {
      throw new TileArchiveError(
        "COVERAGE_QUERY_INVALID",
        "Coverage west and east must describe a non-empty longitude range.",
        400,
      );
    }
    const selection = this.coverageSelection(mapSet.id, query.selection);
    const compareTo =
      query.compareTo === undefined
        ? null
        : this.coverageSelection(mapSet.id, query.compareTo);
    const ranges = wgs84BoundsToXyzTileRanges(query.bounds, query.zoom);
    const maximumCells = query.maximumCells ?? 1024;
    const aggregationZoom = this.coverageAggregationZoom(
      ranges,
      query.zoom,
      maximumCells,
    );
    const cells = this.coverageCells(ranges, query.zoom, aggregationZoom);
    const staleBefore = new Date(
      this.clock().getTime() - mapSet.cachePolicy.maximumAgeSeconds * 1000,
    ).toISOString();
    const aggregates = this.repository.coverageAggregates({
      mapSetId: mapSet.id,
      zoom: query.zoom,
      aggregationZoom,
      ranges,
      selection,
      compareTo,
      staleBefore,
    });
    const aggregatesById = new Map(
      aggregates.map((aggregate) => [
        `${aggregationZoom}/${aggregate.x}/${aggregate.y}`,
        aggregate,
      ]),
    );
    const responseCells: CoverageCell[] = cells.map((cell) => {
      const aggregate = aggregatesById.get(cell.id);
      return {
        ...cell,
        revisionCount: aggregate?.revisionCount ?? 0,
        byteLength: aggregate?.byteLength ?? 0,
        newestValidatedAt: aggregate?.newestValidatedAt ?? null,
        oldestValidatedAt: aggregate?.oldestValidatedAt ?? null,
        statuses: {
          fresh: aggregate?.statuses.fresh ?? 0,
          stale: aggregate?.statuses.stale ?? 0,
          missing: cell.tileCount - (aggregate?.primaryCount ?? 0),
        },
        comparison:
          aggregate?.comparison ??
          (compareTo === null
            ? null
            : {
                identical: 0,
                changed: 0,
                added: 0,
                missing: 0,
              }),
      };
    });
    const totals = responseCells.reduce(
      (result, cell) => ({
        tileCount: result.tileCount + cell.tileCount,
        revisionCount: result.revisionCount + cell.revisionCount,
        byteLength: result.byteLength + cell.byteLength,
        statuses: {
          fresh: result.statuses.fresh + cell.statuses.fresh,
          missing: result.statuses.missing + cell.statuses.missing,
          stale: result.statuses.stale + cell.statuses.stale,
        },
        comparison:
          result.comparison === null || cell.comparison === null
            ? null
            : {
                identical:
                  result.comparison.identical + cell.comparison.identical,
                changed: result.comparison.changed + cell.comparison.changed,
                added: result.comparison.added + cell.comparison.added,
                missing: result.comparison.missing + cell.comparison.missing,
              },
      }),
      {
        tileCount: 0,
        revisionCount: 0,
        byteLength: 0,
        statuses: { fresh: 0, missing: 0, stale: 0 },
        comparison:
          compareTo === null
            ? null
            : { identical: 0, changed: 0, added: 0, missing: 0 },
      } satisfies CoverageResponse["totals"],
    );
    return {
      mapSetId: mapSet.id,
      sourceZoom: query.zoom,
      aggregationZoom,
      bounds: query.bounds,
      selection: query.selection,
      compareTo: query.compareTo ?? null,
      totals,
      cells: responseCells,
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

    const contentType = await validateProviderTile(mapSet, response);
    const recorded = await this.persistContent(mapSet, tile, {
      body: response.body,
      contentType,
      origin: "provider",
      etag: headerValue(response.headers.etag),
      lastModified: headerValue(response.headers["last-modified"]),
    });
    return {
      ...response,
      cacheStatus: cached === undefined ? "miss" : "validated",
      revisionId: recorded.revision.id,
    };
  }

  private async persistContent(
    mapSet: MapSet,
    tile: TileCoordinate,
    input: {
      body: Buffer;
      contentType: string;
      origin: TileRevisionOrigin;
      etag: string | null;
      lastModified: string | null;
    },
  ) {
    const contentHash = createHash("sha256").update(input.body).digest("hex");
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
        currentBytes - replacedBytes + input.body.byteLength >
        maximumStorageBytes
      ) {
        throw new TileArchiveError(
          "TILE_STORAGE_LIMIT",
          "The configured Map Set storage limit would be exceeded.",
          507,
        );
      }
    }
    await this.storage.writeAtomic(filePath, input.body);
    return this.repository.recordContent({
      mapSetId: mapSet.id,
      tile,
      contentHash,
      filePath,
      contentType: input.contentType,
      byteLength: input.body.byteLength,
      etag: input.etag,
      lastModified: input.lastModified,
      timestamp: this.clock().toISOString(),
      origin: input.origin,
    });
  }

  private coordinateKey(mapSetId: string, tile: TileCoordinate): string {
    return `${mapSetId}/${tile.zoom}/${tile.x}/${tile.y}`;
  }

  private withCoordinateLock<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.coordinateOperations.get(key);
    const result =
      previous === undefined
        ? operation()
        : previous.catch(() => undefined).then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.coordinateOperations.set(key, tail);
    return result.finally(() => {
      if (this.coordinateOperations.get(key) === tail) {
        this.coordinateOperations.delete(key);
      }
    });
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

  private coverageSelection(
    mapSetId: string,
    selection: CoverageSelection,
  ): Exclude<TileSelection, { kind: "revision" }> {
    if (selection.kind === "current") {
      return { kind: "current" };
    }
    if (selection.kind === "snapshot") {
      if (selection.snapshotId === undefined) {
        throw new TileArchiveError(
          "COVERAGE_QUERY_INVALID",
          "Coverage Snapshot selection requires snapshotId.",
          400,
        );
      }
      const snapshot = this.repository.snapshotById(selection.snapshotId);
      if (snapshot?.mapSetId !== mapSetId) {
        throw new TileArchiveError(
          "SNAPSHOT_NOT_FOUND",
          "The requested Cache Snapshot does not exist.",
          404,
        );
      }
      return { kind: "snapshot", snapshotId: selection.snapshotId };
    }
    if (selection.timestamp === undefined) {
      throw new TileArchiveError(
        "COVERAGE_QUERY_INVALID",
        "Coverage time selection requires timestamp.",
        400,
      );
    }
    const timestamp = new Date(selection.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      throw new TileArchiveError(
        "COVERAGE_QUERY_INVALID",
        "Coverage asOf must be a valid timestamp.",
        400,
      );
    }
    return { kind: "as-of", timestamp: timestamp.toISOString() };
  }

  private coverageAggregationZoom(
    ranges: readonly XyzTileRange[],
    sourceZoom: number,
    maximumCells: number,
  ): number {
    for (let zoom = sourceZoom; zoom >= 0; zoom -= 1) {
      const factor = 2 ** (sourceZoom - zoom);
      const cellCount = ranges.reduce(
        (total, range) =>
          total +
          (Math.floor(range.maximumX / factor) -
            Math.floor(range.minimumX / factor) +
            1) *
            (Math.floor(range.maximumY / factor) -
              Math.floor(range.minimumY / factor) +
              1),
        0,
      );
      if (cellCount <= maximumCells || zoom === 0) {
        return zoom;
      }
    }
    return 0;
  }

  private coverageCells(
    ranges: readonly XyzTileRange[],
    sourceZoom: number,
    aggregationZoom: number,
  ): Array<
    Pick<CoverageCell, "id" | "zoom" | "x" | "y" | "bounds" | "tileCount">
  > {
    const factor = 2 ** (sourceZoom - aggregationZoom);
    const cells = new Map<
      string,
      Pick<CoverageCell, "id" | "zoom" | "x" | "y" | "bounds" | "tileCount">
    >();
    for (const range of ranges) {
      const minimumCellX = Math.floor(range.minimumX / factor);
      const maximumCellX = Math.floor(range.maximumX / factor);
      const minimumCellY = Math.floor(range.minimumY / factor);
      const maximumCellY = Math.floor(range.maximumY / factor);
      for (let y = minimumCellY; y <= maximumCellY; y += 1) {
        for (let x = minimumCellX; x <= maximumCellX; x += 1) {
          const id = `${aggregationZoom}/${x}/${y}`;
          const width =
            Math.min(range.maximumX, (x + 1) * factor - 1) -
            Math.max(range.minimumX, x * factor) +
            1;
          const height =
            Math.min(range.maximumY, (y + 1) * factor - 1) -
            Math.max(range.minimumY, y * factor) +
            1;
          const existing = cells.get(id);
          if (existing !== undefined) {
            existing.tileCount += width * height;
          } else {
            cells.set(id, {
              id,
              zoom: aggregationZoom,
              x,
              y,
              bounds: xyzTileBounds({ zoom: aggregationZoom, x, y }),
              tileCount: width * height,
            });
          }
        }
      }
    }
    return [...cells.values()].sort((left, right) =>
      left.y === right.y ? left.x - right.x : left.y - right.y,
    );
  }

  private isFresh(
    revision: Pick<StoredTileRevision, "lastValidatedAt">,
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
