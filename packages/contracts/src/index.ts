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
    "Unmodified PNG, JPEG, or WebP tile bytes with the matching image Content-Type.",
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
