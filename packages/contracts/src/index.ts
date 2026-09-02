import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal("ok"),
  },
  { $id: "HealthResponse" },
);

export type HealthResponse = Static<typeof HealthResponseSchema>;

export const ReadyResponseSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("ready"), Type.Literal("not-ready")]),
  },
  { $id: "ReadyResponse" },
);

export type ReadyResponse = Static<typeof ReadyResponseSchema>;

export const TileFormatSchema = Type.Union([
  Type.Literal("png"),
  Type.Literal("jpeg"),
  Type.Literal("webp"),
]);

export type TileFormat = Static<typeof TileFormatSchema>;

export const MapSetCapabilitiesSchema = Type.Object(
  {
    interactive: Type.Boolean(),
    tileArchive: Type.Boolean(),
    batchDownload: Type.Boolean(),
    serverExport: Type.Boolean(),
    layerRendering: Type.Boolean(),
  },
  { additionalProperties: false, $id: "MapSetCapabilities" },
);

export type MapSetCapabilities = Static<typeof MapSetCapabilitiesSchema>;

export const MapSetInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    sourceType: Type.Literal("xyz-raster"),
    urlTemplate: Type.String({ minLength: 1, maxLength: 4096 }),
    attribution: Type.String({ minLength: 1, maxLength: 2000 }),
    termsUrl: Type.String({ maxLength: 4096 }),
    notes: Type.String({ maxLength: 10_000 }),
    termsReviewedAt: Type.String({ maxLength: 64 }),
    minZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    maxZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    tileSize: Type.Union([Type.Literal(256), Type.Literal(512)]),
    tileFormat: TileFormatSchema,
    subdomains: Type.Array(
      Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-zA-Z0-9.-]+$" }),
      { maxItems: 16, uniqueItems: true },
    ),
    headers: Type.Record(
      Type.String({ minLength: 1, maxLength: 128 }),
      Type.String({ maxLength: 4096 }),
    ),
    sourceProjection: Type.Literal("EPSG:3857"),
    defaultCenter: Type.Object(
      {
        longitude: Type.Number({ minimum: -180, maximum: 180 }),
        latitude: Type.Number({ minimum: -85.05112878, maximum: 85.05112878 }),
      },
      { additionalProperties: false },
    ),
    defaultZoom: Type.Number({ minimum: 0, maximum: 24 }),
    rendererId: Type.String({ minLength: 1, maxLength: 128 }),
    capabilities: MapSetCapabilitiesSchema,
    cachePolicy: Type.Object(
      {
        enabled: Type.Boolean(),
        maximumAgeSeconds: Type.Integer({ minimum: 0, maximum: 31_536_000 }),
        maximumStorageBytes: Type.Union([
          Type.Null(),
          Type.Integer({ minimum: 1 }),
        ]),
      },
      { additionalProperties: false },
    ),
    downloadPolicy: Type.Object(
      {
        requestsPerSecond: Type.Number({ exclusiveMinimum: 0, maximum: 1000 }),
        concurrency: Type.Integer({ minimum: 1, maximum: 64 }),
        retryLimit: Type.Integer({ minimum: 0, maximum: 20 }),
        dailyRequestLimit: Type.Union([
          Type.Null(),
          Type.Integer({ minimum: 1 }),
        ]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "MapSetInput" },
);

export type MapSetInput = Static<typeof MapSetInputSchema>;

export const MapSetPatchSchema = Type.Partial(MapSetInputSchema, {
  additionalProperties: false,
  $id: "MapSetPatch",
});

export type MapSetPatch = Static<typeof MapSetPatchSchema>;

export const MapSetSchema = Type.Composite(
  [
    MapSetInputSchema,
    Type.Object(
      {
        id: Type.String({
          pattern:
            "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        }),
        createdAt: Type.String(),
        updatedAt: Type.String(),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "MapSet" },
);

export type MapSet = Static<typeof MapSetSchema>;

export const MapSetListItemSchema = Type.Composite(
  [
    MapSetSchema,
    Type.Object(
      { logicalTileCount: Type.Integer({ minimum: 0 }) },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "MapSetListItem" },
);

export type MapSetListItem = Static<typeof MapSetListItemSchema>;

export const MapSetListResponseSchema = Type.Object(
  {
    items: Type.Array(MapSetListItemSchema),
  },
  { additionalProperties: false, $id: "MapSetListResponse" },
);

export type MapSetListResponse = Static<typeof MapSetListResponseSchema>;

export const LayerStatusSchema = Type.Union([
  Type.Literal("ready"),
  Type.Literal("plugin-missing"),
  Type.Literal("incompatible"),
  Type.Literal("migration-failed"),
]);

export type LayerStatus = Static<typeof LayerStatusSchema>;

export const LayerInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    pluginId: Type.String({
      minLength: 1,
      maxLength: 128,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    }),
    configuration: Type.Record(Type.String(), Type.Unknown()),
    data: Type.Record(Type.String(), Type.Unknown()),
    visible: Type.Boolean(),
    displayOrder: Type.Integer({ minimum: 0 }),
    opacity: Type.Number({ minimum: 0, maximum: 1 }),
    minimumZoom: Type.Union([
      Type.Null(),
      Type.Number({ minimum: 0, maximum: 24 }),
    ]),
    maximumZoom: Type.Union([
      Type.Null(),
      Type.Number({ minimum: 0, maximum: 24 }),
    ]),
  },
  { additionalProperties: false, $id: "LayerInput" },
);

export type LayerInput = Static<typeof LayerInputSchema>;

export const LayerPatchSchema = Type.Partial(LayerInputSchema, {
  additionalProperties: false,
  $id: "LayerPatch",
});

export type LayerPatch = Static<typeof LayerPatchSchema>;

export const LayerSchema = Type.Composite(
  [
    LayerInputSchema,
    Type.Object(
      {
        id: Type.String(),
        pluginVersion: Type.String(),
        schemaVersion: Type.Integer({ minimum: 1 }),
        status: LayerStatusSchema,
        diagnostic: Type.Union([Type.String(), Type.Null()]),
        createdAt: Type.String(),
        updatedAt: Type.String(),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "Layer" },
);

export type Layer = Static<typeof LayerSchema>;

export const LayerListResponseSchema = Type.Object(
  { items: Type.Array(LayerSchema) },
  { additionalProperties: false, $id: "LayerListResponse" },
);

export type LayerListResponse = Static<typeof LayerListResponseSchema>;

export const CoordinateSourceSchema = Type.Union([
  Type.Literal("exif"),
  Type.Literal("manual"),
  Type.Literal("none"),
]);

export type CoordinateSource = Static<typeof CoordinateSourceSchema>;

export const LayerAssetStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("ready"),
  Type.Literal("changed"),
  Type.Literal("missing"),
  Type.Literal("failed"),
]);

export const PhotoMetadataSchema = Type.Object(
  {
    capturedAt: Type.Optional(Type.String()),
    manufacturer: Type.Optional(Type.String()),
    cameraModel: Type.Optional(Type.String()),
    iso: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    fStop: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    shutterSpeed: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    iptc: Type.Optional(
      Type.Object({ caption: Type.String() }, { additionalProperties: false }),
    ),
  },
  { additionalProperties: false, $id: "PhotoMetadata" },
);

export type PhotoMetadata = Static<typeof PhotoMetadataSchema>;

export const LayerAssetSchema = Type.Object(
  {
    id: Type.String(),
    layerId: Type.String(),
    kind: Type.Union([Type.Literal("managed"), Type.Literal("external-photo")]),
    status: LayerAssetStatusSchema,
    fileName: Type.String(),
    contentType: Type.Union([Type.String(), Type.Null()]),
    byteLength: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    contentHash: Type.Union([Type.String(), Type.Null()]),
    relativePath: Type.Union([Type.String(), Type.Null()]),
    sourceModifiedAt: Type.Union([Type.String(), Type.Null()]),
    width: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    height: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    longitude: Type.Union([
      Type.Number({ minimum: -180, maximum: 180 }),
      Type.Null(),
    ]),
    latitude: Type.Union([
      Type.Number({ minimum: -90, maximum: 90 }),
      Type.Null(),
    ]),
    coordinateSource: CoordinateSourceSchema,
    photoMetadata: Type.Optional(PhotoMetadataSchema),
    previewAvailable: Type.Boolean(),
    errorCode: Type.Union([Type.String(), Type.Null()]),
    errorMessage: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  },
  { additionalProperties: false, $id: "LayerAsset" },
);

export type LayerAsset = Static<typeof LayerAssetSchema>;

export const LayerAssetPatchSchema = Type.Object(
  {
    longitude: Type.Union([
      Type.Null(),
      Type.Number({ minimum: -180, maximum: 180 }),
    ]),
    latitude: Type.Union([
      Type.Null(),
      Type.Number({ minimum: -90, maximum: 90 }),
    ]),
  },
  { additionalProperties: false, $id: "LayerAssetPatch" },
);

export type LayerAssetPatch = Static<typeof LayerAssetPatchSchema>;

export const LayerAssetImportResponseSchema = Type.Object(
  {
    layer: LayerSchema,
    asset: LayerAssetSchema,
  },
  { additionalProperties: false, $id: "LayerAssetImportResponse" },
);

export const LayerAssetListResponseSchema = Type.Object(
  {
    items: Type.Array(LayerAssetSchema),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: "LayerAssetListResponse" },
);

export const LayerAssetExtentSchema = Type.Object(
  {
    coordinateCount: Type.Integer({ minimum: 0 }),
    bounds: Type.Union([
      Type.Null(),
      Type.Object(
        {
          west: Type.Number({ minimum: -180, maximum: 180 }),
          south: Type.Number({ minimum: -90, maximum: 90 }),
          east: Type.Number({ minimum: -180, maximum: 180 }),
          north: Type.Number({ minimum: -90, maximum: 90 }),
        },
        { additionalProperties: false },
      ),
    ]),
  },
  { additionalProperties: false, $id: "LayerAssetExtent" },
);

export type LayerAssetExtent = Static<typeof LayerAssetExtentSchema>;

export const PhotoDirectoryStatusSchema = Type.Object(
  { configured: Type.Boolean(), available: Type.Boolean() },
  { additionalProperties: false, $id: "PhotoDirectoryStatus" },
);

export type PhotoDirectoryStatus = Static<typeof PhotoDirectoryStatusSchema>;

export const PhotoDirectoryEntrySchema = Type.Object(
  {
    name: Type.String(),
    relativePath: Type.String(),
  },
  { additionalProperties: false, $id: "PhotoDirectoryEntry" },
);

export type PhotoDirectoryEntry = Static<typeof PhotoDirectoryEntrySchema>;

export const PhotoDirectoryListingSchema = Type.Object(
  {
    relativeDirectory: Type.String(),
    parentDirectory: Type.Union([Type.String(), Type.Null()]),
    items: Type.Array(PhotoDirectoryEntrySchema),
  },
  { additionalProperties: false, $id: "PhotoDirectoryListing" },
);

export type PhotoDirectoryListing = Static<typeof PhotoDirectoryListingSchema>;

export const PhotoScanJobInputSchema = Type.Object(
  {
    relativeDirectory: Type.String({ maxLength: 4096 }),
    recursive: Type.Boolean(),
  },
  { additionalProperties: false, $id: "PhotoScanJobInput" },
);

export type PhotoScanJobInput = Static<typeof PhotoScanJobInputSchema>;

export const JobStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("paused"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
]);

export const JobSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Union([
      Type.Literal("photo-scan"),
      Type.Literal("tile-download"),
      Type.Literal("map-export"),
    ]),
    status: JobStatusSchema,
    input: Type.Record(Type.String(), Type.Unknown()),
    total: Type.Integer({ minimum: 0 }),
    completed: Type.Integer({ minimum: 0 }),
    skipped: Type.Integer({ minimum: 0 }),
    failed: Type.Integer({ minimum: 0 }),
    summary: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    lastError: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
    startedAt: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.String(),
    finishedAt: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: "Job" },
);

export type Job = Static<typeof JobSchema>;

export const JobListResponseSchema = Type.Object(
  { items: Type.Array(JobSchema) },
  { additionalProperties: false, $id: "JobListResponse" },
);

export const JobErrorSchema = Type.Object(
  {
    id: Type.Integer({ minimum: 1 }),
    code: Type.String(),
    message: Type.String(),
    item: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
  },
  { additionalProperties: false, $id: "JobError" },
);

export type JobError = Static<typeof JobErrorSchema>;

export const JobErrorListResponseSchema = Type.Object(
  { items: Type.Array(JobErrorSchema) },
  { additionalProperties: false, $id: "JobErrorListResponse" },
);

export const JobCleanupResponseSchema = Type.Object(
  {
    deletedJobs: Type.Integer({ minimum: 0 }),
    cutoff: Type.String(),
  },
  { additionalProperties: false, $id: "JobCleanupResponse" },
);

export type JobCleanupResponse = Static<typeof JobCleanupResponseSchema>;

export const MapSetTestResponseSchema = Type.Object(
  {
    ok: Type.Boolean(),
    tile: Type.Object(
      {
        zoom: Type.Integer(),
        x: Type.Integer(),
        y: Type.Integer(),
      },
      { additionalProperties: false },
    ),
    statusCode: Type.Union([Type.Integer(), Type.Null()]),
    contentType: Type.Union([Type.String(), Type.Null()]),
    byteLength: Type.Union([Type.Integer(), Type.Null()]),
    durationMilliseconds: Type.Integer({ minimum: 0 }),
    message: Type.String(),
  },
  { additionalProperties: false, $id: "MapSetTestResponse" },
);

export type MapSetTestResponse = Static<typeof MapSetTestResponseSchema>;

export const TileRefreshModeSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("force"),
  Type.Literal("cache-only"),
]);

export type TileRefreshMode = Static<typeof TileRefreshModeSchema>;

export const TileRevisionOriginSchema = Type.Union([
  Type.Literal("provider"),
  Type.Literal("upload"),
]);

export type TileRevisionOrigin = Static<typeof TileRevisionOriginSchema>;

export const TileRevisionSummarySchema = Type.Object(
  {
    id: Type.String(),
    zoom: Type.Integer(),
    x: Type.Integer(),
    y: Type.Integer(),
    contentHash: Type.String(),
    contentType: Type.String(),
    byteLength: Type.Integer({ minimum: 0 }),
    firstSeenAt: Type.String(),
    lastSeenAt: Type.String(),
    lastValidatedAt: Type.String(),
    origin: TileRevisionOriginSchema,
    current: Type.Boolean(),
  },
  { additionalProperties: false, $id: "TileRevisionSummary" },
);

export type TileRevisionSummary = Static<typeof TileRevisionSummarySchema>;

export const TileRevisionListResponseSchema = Type.Object(
  {
    items: Type.Array(TileRevisionSummarySchema),
    total: Type.Integer({ minimum: 0 }),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: "TileRevisionListResponse" },
);

export type TileRevisionListResponse = Static<
  typeof TileRevisionListResponseSchema
>;

export const TileUploadBodySchema = Type.Unsafe<unknown>({
  anyOf: [{ type: "string", format: "binary" }, { type: "object" }],
  description:
    "A decodable PNG, JPEG, or WebP image with the configured tile format, dimensions, and matching image Content-Type.",
  $id: "TileUploadBody",
});

export const TileUploadResponseSchema = Type.Object(
  {
    revisionId: Type.String(),
    created: Type.Boolean(),
  },
  { additionalProperties: false, $id: "TileUploadResponse" },
);

export type TileUploadResponse = Static<typeof TileUploadResponseSchema>;

export const CacheSnapshotCreateInputSchema = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 120 }) },
  { additionalProperties: false, $id: "CacheSnapshotCreateInput" },
);

export type CacheSnapshotCreateInput = Static<
  typeof CacheSnapshotCreateInputSchema
>;

export const CacheSnapshotSchema = Type.Object(
  {
    id: Type.String(),
    mapSetId: Type.String(),
    name: Type.String(),
    createdAt: Type.String(),
    tileCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false, $id: "CacheSnapshot" },
);

export type CacheSnapshot = Static<typeof CacheSnapshotSchema>;

export const CacheSnapshotListResponseSchema = Type.Object(
  { items: Type.Array(CacheSnapshotSchema) },
  { additionalProperties: false, $id: "CacheSnapshotListResponse" },
);

export type CacheSnapshotListResponse = Static<
  typeof CacheSnapshotListResponseSchema
>;

export const TileCacheZoomStatsSchema = Type.Object(
  {
    zoom: Type.Integer({ minimum: 0 }),
    logicalTileCount: Type.Integer({ minimum: 0 }),
    currentRevisionCount: Type.Integer({ minimum: 0 }),
    historicalRevisionCount: Type.Integer({ minimum: 0 }),
    totalRevisionCount: Type.Integer({ minimum: 0 }),
    indexedStorageBytes: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false, $id: "TileCacheZoomStats" },
);

export type TileCacheZoomStats = Static<typeof TileCacheZoomStatsSchema>;

export const TileCacheStatsSchema = Type.Object(
  {
    logicalTileCount: Type.Integer({ minimum: 0 }),
    currentRevisionCount: Type.Integer({ minimum: 0 }),
    historicalRevisionCount: Type.Integer({ minimum: 0 }),
    totalRevisionCount: Type.Integer({ minimum: 0 }),
    snapshotCount: Type.Integer({ minimum: 0 }),
    uniqueContentCount: Type.Integer({ minimum: 0 }),
    totalStorageBytes: Type.Integer({ minimum: 0 }),
    zoomLevels: Type.Array(TileCacheZoomStatsSchema),
  },
  { additionalProperties: false, $id: "TileCacheStats" },
);

export type TileCacheStats = Static<typeof TileCacheStatsSchema>;

export const TileCacheUnsupportedZoomInfoSchema = Type.Object(
  {
    zoomLevels: Type.Array(Type.Integer({ minimum: 0 })),
    logicalTileCount: Type.Integer({ minimum: 0 }),
    revisionCount: Type.Integer({ minimum: 0 }),
    deletableLogicalTileCount: Type.Integer({ minimum: 0 }),
    snapshotProtectedLogicalTileCount: Type.Integer({ minimum: 0 }),
    indexedStorageBytes: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false, $id: "TileCacheUnsupportedZoomInfo" },
);

export type TileCacheUnsupportedZoomInfo = Static<
  typeof TileCacheUnsupportedZoomInfoSchema
>;

export const TileCacheUnsupportedZoomCleanupResultSchema = Type.Object(
  {
    removedLogicalTileCount: Type.Integer({ minimum: 0 }),
    removedRevisionCount: Type.Integer({ minimum: 0 }),
    removedFileCount: Type.Integer({ minimum: 0 }),
    removedIndexedStorageBytes: Type.Integer({ minimum: 0 }),
    remaining: TileCacheUnsupportedZoomInfoSchema,
  },
  {
    additionalProperties: false,
    $id: "TileCacheUnsupportedZoomCleanupResult",
  },
);

export type TileCacheUnsupportedZoomCleanupResult = Static<
  typeof TileCacheUnsupportedZoomCleanupResultSchema
>;

export const TileCacheMapSetSummarySchema = Type.Object(
  {
    mapSetId: Type.String(),
    logicalTileCount: Type.Integer({ minimum: 0 }),
    currentRevisionCount: Type.Integer({ minimum: 0 }),
    historicalRevisionCount: Type.Integer({ minimum: 0 }),
    totalRevisionCount: Type.Integer({ minimum: 0 }),
    snapshotCount: Type.Integer({ minimum: 0 }),
    uniqueContentCount: Type.Integer({ minimum: 0 }),
    totalStorageBytes: Type.Integer({ minimum: 0 }),
    oldestCurrentValidatedAt: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: "TileCacheMapSetSummary" },
);

export type TileCacheMapSetSummary = Static<
  typeof TileCacheMapSetSummarySchema
>;

export const TileCacheOverviewStatsSchema = Type.Object(
  {
    mapSetCount: Type.Integer({ minimum: 0 }),
    populatedMapSetCount: Type.Integer({ minimum: 0 }),
    stats: TileCacheStatsSchema,
    mapSets: Type.Array(TileCacheMapSetSummarySchema),
  },
  { additionalProperties: false, $id: "TileCacheOverviewStats" },
);

export type TileCacheOverviewStats = Static<
  typeof TileCacheOverviewStatsSchema
>;

export const TileCacheAuditResultSchema = Type.Object(
  {
    scannedFileCount: Type.Integer({ minimum: 0 }),
    physicalStorageBytes: Type.Integer({ minimum: 0 }),
    missingFileCount: Type.Integer({ minimum: 0 }),
    orphanFileCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false, $id: "TileCacheAuditResult" },
);

export type TileCacheAuditResult = Static<typeof TileCacheAuditResultSchema>;

export const TileCacheMapSetAuditResultSchema = Type.Composite(
  [Type.Object({ mapSetId: Type.String() }), TileCacheAuditResultSchema],
  { additionalProperties: false, $id: "TileCacheMapSetAuditResult" },
);

export type TileCacheMapSetAuditResult = Static<
  typeof TileCacheMapSetAuditResultSchema
>;

export const TileCacheOverviewAuditResultSchema = Type.Object(
  {
    totals: TileCacheAuditResultSchema,
    mapSets: Type.Array(TileCacheMapSetAuditResultSchema),
  },
  { additionalProperties: false, $id: "TileCacheOverviewAuditResult" },
);

export type TileCacheOverviewAuditResult = Static<
  typeof TileCacheOverviewAuditResultSchema
>;

export const TileCacheRepairResultSchema = Type.Object(
  {
    scannedFileCount: Type.Integer({ minimum: 0 }),
    removedOrphanFileCount: Type.Integer({ minimum: 0 }),
    removedOrphanBytes: Type.Integer({ minimum: 0 }),
    removedMissingFileCount: Type.Integer({ minimum: 0 }),
    removedMissingRevisionCount: Type.Integer({ minimum: 0 }),
    removedLogicalTileCount: Type.Integer({ minimum: 0 }),
    removedSnapshotReferenceCount: Type.Integer({ minimum: 0 }),
    audit: TileCacheAuditResultSchema,
  },
  { additionalProperties: false, $id: "TileCacheRepairResult" },
);

export type TileCacheRepairResult = Static<typeof TileCacheRepairResultSchema>;

export const TileCacheComparisonSchema = Type.Object(
  {
    left: Type.String(),
    right: Type.String(),
    identical: Type.Integer({ minimum: 0 }),
    changed: Type.Integer({ minimum: 0 }),
    added: Type.Integer({ minimum: 0 }),
    missing: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false, $id: "TileCacheComparison" },
);

export type TileCacheComparison = Static<typeof TileCacheComparisonSchema>;

export const CoverageBoundsSchema = Type.Object(
  {
    west: Type.Number({ minimum: -180, maximum: 180 }),
    south: Type.Number({ minimum: -85.05112878, maximum: 85.05112878 }),
    east: Type.Number({ minimum: -180, maximum: 180 }),
    north: Type.Number({ minimum: -85.05112878, maximum: 85.05112878 }),
  },
  { additionalProperties: false },
);

export type CoverageBounds = Static<typeof CoverageBoundsSchema>;

export const TileDownloadRefreshModeSchema = Type.Union([
  Type.Literal("missing"),
  Type.Literal("missing-or-stale"),
]);

export type TileDownloadRefreshMode = Static<
  typeof TileDownloadRefreshModeSchema
>;

export const TileDownloadInputSchema = Type.Object(
  {
    bounds: CoverageBoundsSchema,
    minimumZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    maximumZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    refreshMode: TileDownloadRefreshModeSchema,
  },
  { additionalProperties: false, $id: "TileDownloadInput" },
);

export type TileDownloadInput = Static<typeof TileDownloadInputSchema>;

export const TileDownloadEstimateSchema = Type.Object(
  {
    bounds: CoverageBoundsSchema,
    minimumZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    maximumZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    refreshMode: TileDownloadRefreshModeSchema,
    totalTiles: Type.Integer({ minimum: 0 }),
    freshTiles: Type.Integer({ minimum: 0 }),
    staleTiles: Type.Integer({ minimum: 0 }),
    missingTiles: Type.Integer({ minimum: 0 }),
    requestTiles: Type.Integer({ minimum: 0 }),
    estimatedBytes: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    warningTileCount: Type.Integer({ minimum: 1 }),
    maximumTileCount: Type.Integer({ minimum: 1 }),
    dailyRequestLimit: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    dailyRequestsRemaining: Type.Union([
      Type.Integer({ minimum: 0 }),
      Type.Null(),
    ]),
    warnings: Type.Array(Type.String()),
    blockedReasons: Type.Array(Type.String()),
  },
  { additionalProperties: false, $id: "TileDownloadEstimate" },
);

export type TileDownloadEstimate = Static<typeof TileDownloadEstimateSchema>;

export const CoverageSelectionSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("current"),
      Type.Literal("snapshot"),
      Type.Literal("asOf"),
    ]),
    snapshotId: Type.Optional(Type.String({ minLength: 1 })),
    timestamp: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  },
  { additionalProperties: false },
);

export type CoverageSelection = Static<typeof CoverageSelectionSchema>;

export const CoverageQuerySchema = Type.Object(
  {
    bounds: CoverageBoundsSchema,
    zoom: Type.Integer({ minimum: 0, maximum: 24 }),
    selection: CoverageSelectionSchema,
    compareTo: Type.Optional(CoverageSelectionSchema),
    maximumCells: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 4096, default: 1024 }),
    ),
  },
  { additionalProperties: false, $id: "CoverageQuery" },
);

export type CoverageQuery = Static<typeof CoverageQuerySchema>;

export const CoverageStatusCountsSchema = Type.Object(
  {
    fresh: Type.Integer({ minimum: 0 }),
    missing: Type.Integer({ minimum: 0 }),
    stale: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type CoverageStatusCounts = Static<typeof CoverageStatusCountsSchema>;

export const CoverageComparisonCountsSchema = Type.Object(
  {
    identical: Type.Integer({ minimum: 0 }),
    changed: Type.Integer({ minimum: 0 }),
    added: Type.Integer({ minimum: 0 }),
    missing: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type CoverageComparisonCounts = Static<
  typeof CoverageComparisonCountsSchema
>;

export const CoverageCellSchema = Type.Object(
  {
    id: Type.String(),
    zoom: Type.Integer({ minimum: 0, maximum: 24 }),
    x: Type.Integer({ minimum: 0 }),
    y: Type.Integer({ minimum: 0 }),
    bounds: CoverageBoundsSchema,
    tileCount: Type.Integer({ minimum: 0 }),
    revisionCount: Type.Integer({ minimum: 0 }),
    byteLength: Type.Integer({ minimum: 0 }),
    newestValidatedAt: Type.Union([Type.String(), Type.Null()]),
    oldestValidatedAt: Type.Union([Type.String(), Type.Null()]),
    statuses: CoverageStatusCountsSchema,
    comparison: Type.Union([CoverageComparisonCountsSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export type CoverageCell = Static<typeof CoverageCellSchema>;

export const CoverageResponseSchema = Type.Object(
  {
    mapSetId: Type.String(),
    sourceZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    aggregationZoom: Type.Integer({ minimum: 0, maximum: 24 }),
    bounds: CoverageBoundsSchema,
    selection: CoverageSelectionSchema,
    compareTo: Type.Union([CoverageSelectionSchema, Type.Null()]),
    totals: Type.Object(
      {
        tileCount: Type.Integer({ minimum: 0 }),
        revisionCount: Type.Integer({ minimum: 0 }),
        byteLength: Type.Integer({ minimum: 0 }),
        statuses: CoverageStatusCountsSchema,
        comparison: Type.Union([CoverageComparisonCountsSchema, Type.Null()]),
      },
      { additionalProperties: false },
    ),
    cells: Type.Array(CoverageCellSchema, { maxItems: 4096 }),
  },
  { additionalProperties: false, $id: "CoverageResponse" },
);

export type CoverageResponse = Static<typeof CoverageResponseSchema>;

export const ErrorResponseSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "ErrorResponse" },
);

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

export function createDefaultMapSetInput(): MapSetInput {
  return {
    name: "New Map Set",
    sourceType: "xyz-raster",
    urlTemplate: "https://example.com/tiles/{z}/{x}/{y}.png",
    attribution: "Add the attribution required by the provider",
    termsUrl: "",
    notes: "",
    termsReviewedAt: "",
    minZoom: 0,
    maxZoom: 18,
    tileSize: 256,
    tileFormat: "png",
    subdomains: [],
    headers: {},
    sourceProjection: "EPSG:3857",
    defaultCenter: { longitude: 13.405, latitude: 52.52 },
    defaultZoom: 10,
    rendererId: "leaflet-xyz",
    capabilities: {
      interactive: true,
      tileArchive: true,
      batchDownload: true,
      serverExport: true,
      layerRendering: true,
    },
    cachePolicy: {
      enabled: true,
      maximumAgeSeconds: 604_800,
      maximumStorageBytes: null,
    },
    downloadPolicy: {
      requestsPerSecond: 2,
      concurrency: 2,
      retryLimit: 3,
      dailyRequestLimit: null,
    },
  };
}

export function mapSetInputValidationErrors(value: unknown): string[] {
  return [...Value.Errors(MapSetInputSchema, value)].map(
    ({ message, path }) => `${path || "value"}: ${message}`,
  );
}
