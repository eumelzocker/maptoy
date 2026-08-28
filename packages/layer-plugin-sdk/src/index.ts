export const LAYER_PLUGIN_SDK_VERSION = "1.0.0";

export type MaybePromise<T> = T | Promise<T>;
export type JsonObject = Readonly<Record<string, unknown>>;

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
  elevation?: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PointGeometry {
  type: "Point";
  coordinate: GeographicCoordinate;
}

export interface LineVertex<TProperties = JsonObject> {
  coordinate: GeographicCoordinate;
  properties?: TProperties;
}

export interface LineGeometry<TVertexProperties = JsonObject> {
  type: "LineString";
  vertices: readonly LineVertex<TVertexProperties>[];
}

export interface AreaGeometry {
  type: "Polygon";
  rings: readonly (readonly GeographicCoordinate[])[];
}

export interface LayerFeature<
  TGeometry extends PointGeometry | LineGeometry<unknown> | AreaGeometry,
  TProperties = JsonObject,
> {
  id: string;
  geometry: TGeometry;
  properties: TProperties;
}

export type PointFeature<TProperties = JsonObject> = LayerFeature<
  PointGeometry,
  TProperties
>;

export type LineFeature<
  TProperties = JsonObject,
  TVertexProperties = JsonObject,
> = LayerFeature<LineGeometry<TVertexProperties>, TProperties>;

export type AreaFeature<TProperties = JsonObject> = LayerFeature<
  AreaGeometry,
  TProperties
>;

function geometryInvariant(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Layer geometry validation failed: ${message}`);
  }
}

export function assertGeographicCoordinate(value: GeographicCoordinate): void {
  geometryInvariant(
    Number.isFinite(value.longitude) &&
      value.longitude >= -180 &&
      value.longitude <= 180,
    "longitude must be between -180 and 180",
  );
  geometryInvariant(
    Number.isFinite(value.latitude) &&
      value.latitude >= -90 &&
      value.latitude <= 90,
    "latitude must be between -90 and 90",
  );
  geometryInvariant(
    value.elevation === undefined || Number.isFinite(value.elevation),
    "elevation must be finite",
  );
}

export function assertPointGeometry(value: PointGeometry): void {
  geometryInvariant(value.type === "Point", "expected Point geometry");
  assertGeographicCoordinate(value.coordinate);
}

export function assertLineGeometry(value: LineGeometry<unknown>): void {
  geometryInvariant(
    value.type === "LineString",
    "expected LineString geometry",
  );
  geometryInvariant(
    value.vertices.length >= 2,
    "a line requires at least two vertices",
  );
  for (const vertex of value.vertices) {
    assertGeographicCoordinate(vertex.coordinate);
  }
}

function coordinatesEqual(
  first: GeographicCoordinate,
  second: GeographicCoordinate,
): boolean {
  return (
    first.longitude === second.longitude &&
    first.latitude === second.latitude &&
    first.elevation === second.elevation
  );
}

export function assertAreaGeometry(value: AreaGeometry): void {
  geometryInvariant(value.type === "Polygon", "expected Polygon geometry");
  geometryInvariant(
    value.rings.length >= 1,
    "a polygon requires an outer ring",
  );
  for (const ring of value.rings) {
    geometryInvariant(
      ring.length >= 4,
      "a polygon ring requires at least four coordinates",
    );
    for (const coordinate of ring) {
      assertGeographicCoordinate(coordinate);
    }
    geometryInvariant(
      coordinatesEqual(
        ring[0] as GeographicCoordinate,
        ring.at(-1) as GeographicCoordinate,
      ),
      "a polygon ring must be closed",
    );
  }
}

export interface LayerPluginCapabilities {
  interactive: boolean;
  assetImport: boolean;
  serverPreview: boolean;
  serverRender: boolean;
}

export interface LayerPluginManifest {
  id: string;
  version: string;
  sdkVersion: string;
  displayName: string;
  category: {
    id: string;
    displayName: string;
  };
  schemaVersion: number;
  configurationSchema: JsonObject;
  dataSchema: JsonObject;
  capabilities: LayerPluginCapabilities;
}

export interface LayerPluginMigration {
  fromSchemaVersion: number;
  toSchemaVersion: number;
  migrate: (value: unknown) => MaybePromise<unknown>;
}

export interface LayerPluginSharedHooks {
  validateConfiguration: (value: unknown) => MaybePromise<unknown>;
  validateData: (value: unknown) => MaybePromise<unknown>;
  migrations: readonly LayerPluginMigration[];
}

export interface InteractiveLayerInput {
  configuration: unknown;
  data: unknown;
  assets: readonly LayerPluginAssetReference[];
  opacity: number;
  visible: boolean;
}

export interface LayerPluginAssetReference {
  id: string;
  status: "pending" | "ready" | "changed" | "missing" | "failed";
  fileName: string;
  previewUrl?: string;
  originalUrl?: string;
  longitude: number | null;
  latitude: number | null;
  bounds?: Readonly<{
    west: number;
    south: number;
    east: number;
    north: number;
  }>;
}

export interface InteractiveLayerDescriptor {
  type:
    | "point-collection"
    | "line-collection"
    | "area-collection"
    | "raster-overlay"
    | "composite";
  data: Readonly<{
    kind:
      | "point-collection"
      | "line-collection"
      | "area-collection"
      | "raster-overlay"
      | "composite";
    features?: readonly unknown[];
    layers?: readonly unknown[];
  }>;
}

export interface LayerPluginFrontendContext {
  instanceId: string;
  publishLayer: (descriptor: InteractiveLayerDescriptor) => void;
  clearLayer: () => void;
  resolveAssetUrl: (
    assetId: string,
    variant?: "preview" | "original",
  ) => string;
}

export interface LayerPluginFrontendHandle {
  update: (input: InteractiveLayerInput) => MaybePromise<void>;
  destroy: () => MaybePromise<void>;
}

export interface LayerPluginFrontendHooks {
  mount: (
    context: LayerPluginFrontendContext,
    input: InteractiveLayerInput,
  ) => MaybePromise<LayerPluginFrontendHandle>;
}

export interface ManagedAssetInput {
  assetId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface LayerPluginImportResult {
  configuration: unknown;
  data: unknown;
  managedAssetIds: readonly string[];
}

export interface LayerPluginAssetImportHooks {
  importAsset: (
    asset: ManagedAssetInput,
  ) => MaybePromise<LayerPluginImportResult>;
}

export interface LayerDrawingSurface {
  drawPolyline: (
    coordinates: readonly GeographicCoordinate[],
    style: JsonObject,
  ) => void;
  drawPoint: (coordinate: GeographicCoordinate, style: JsonObject) => void;
  drawManagedImage: (
    assetId: string,
    bounds: readonly [GeographicCoordinate, GeographicCoordinate],
    opacity: number,
  ) => void;
}

export interface LayerPluginServerRenderContext {
  configuration: unknown;
  data: unknown;
  assets: readonly LayerPluginServerAssetReference[];
  project: (coordinate: GeographicCoordinate) => ScreenPoint;
  surface: LayerDrawingSurface;
}

export interface LayerPluginServerAssetReference {
  assetId: string;
  longitude: number | null;
  latitude: number | null;
  bounds?: readonly [GeographicCoordinate, GeographicCoordinate];
}

export interface LayerPluginServerHooks {
  createPreview?: (
    context: LayerPluginServerRenderContext,
  ) => MaybePromise<void>;
  render?: (context: LayerPluginServerRenderContext) => MaybePromise<void>;
}

export interface LayerPluginDefinition {
  manifest: LayerPluginManifest;
  shared: LayerPluginSharedHooks;
  frontend?: LayerPluginFrontendHooks;
  assetImport?: LayerPluginAssetImportHooks;
  server?: LayerPluginServerHooks;
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Layer plugin contract violation: ${message}`);
  }
}

function isSemanticVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function assertValidLayerPluginDefinition(
  definition: LayerPluginDefinition,
): void {
  const { manifest } = definition;
  invariant(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id),
    `invalid plugin id: ${manifest.id}`,
  );
  invariant(isSemanticVersion(manifest.version), "invalid plugin version");
  invariant(
    manifest.sdkVersion === LAYER_PLUGIN_SDK_VERSION,
    `unsupported SDK version: ${manifest.sdkVersion}`,
  );
  invariant(manifest.displayName.trim().length > 0, "empty display name");
  invariant(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.category.id),
    `invalid category id: ${manifest.category.id}`,
  );
  invariant(
    manifest.category.displayName.trim().length > 0,
    "empty category display name",
  );
  invariant(
    Number.isInteger(manifest.schemaVersion) && manifest.schemaVersion >= 1,
    "schema version must be a positive integer",
  );
  invariant(
    manifest.capabilities.interactive === (definition.frontend !== undefined),
    "interactive capability and frontend hook disagree",
  );
  invariant(
    manifest.capabilities.assetImport ===
      (definition.assetImport !== undefined),
    "asset-import capability and hook disagree",
  );
  invariant(
    manifest.capabilities.serverPreview ===
      (definition.server?.createPreview !== undefined),
    "server-preview capability and hook disagree",
  );
  invariant(
    manifest.capabilities.serverRender ===
      (definition.server?.render !== undefined),
    "server-render capability and hook disagree",
  );

  let previousTarget = 0;
  for (const migration of definition.shared.migrations) {
    invariant(
      Number.isInteger(migration.fromSchemaVersion) &&
        migration.toSchemaVersion === migration.fromSchemaVersion + 1,
      "migrations must advance exactly one schema version",
    );
    invariant(
      migration.fromSchemaVersion > previousTarget,
      "migrations must be ordered and unique",
    );
    invariant(
      migration.toSchemaVersion <= manifest.schemaVersion,
      "migration exceeds the current schema version",
    );
    previousTarget = migration.toSchemaVersion;
  }
}

export interface LayerPluginRegistry {
  get: (id: string) => LayerPluginDefinition | undefined;
  list: () => readonly LayerPluginDefinition[];
}

export function createLayerPluginRegistry(
  definitions: readonly LayerPluginDefinition[],
): LayerPluginRegistry {
  const byId = new Map<string, LayerPluginDefinition>();
  for (const definition of definitions) {
    assertValidLayerPluginDefinition(definition);
    invariant(
      !byId.has(definition.manifest.id),
      `duplicate plugin id: ${definition.manifest.id}`,
    );
    byId.set(definition.manifest.id, Object.freeze(definition));
  }
  const registered = Object.freeze([...byId.values()]);
  return Object.freeze({
    get: (id: string) => byId.get(id),
    list: () => registered,
  });
}

export interface LayerPluginContractFixture {
  configuration: unknown;
  data: unknown;
  migration?: {
    fromSchemaVersion: number;
    value: unknown;
  };
  frontendContext?: LayerPluginFrontendContext;
  asset?: ManagedAssetInput;
  renderContext?: LayerPluginServerRenderContext;
}

async function exerciseMigrations(
  definition: LayerPluginDefinition,
  fixture: NonNullable<LayerPluginContractFixture["migration"]>,
): Promise<void> {
  let schemaVersion = fixture.fromSchemaVersion;
  let value = fixture.value;
  while (schemaVersion < definition.manifest.schemaVersion) {
    const migration = definition.shared.migrations.find(
      (candidate) => candidate.fromSchemaVersion === schemaVersion,
    );
    invariant(
      migration !== undefined,
      `missing migration from ${schemaVersion}`,
    );
    const first = await migration.migrate(value);
    const second = await migration.migrate(value);
    invariant(
      JSON.stringify(first) === JSON.stringify(second),
      `migration from ${schemaVersion} is not deterministic`,
    );
    value = first;
    schemaVersion = migration.toSchemaVersion;
  }
  await definition.shared.validateData(value);
}

export async function exerciseLayerPluginContract(
  definition: LayerPluginDefinition,
  fixture: LayerPluginContractFixture,
): Promise<void> {
  assertValidLayerPluginDefinition(definition);
  await definition.shared.validateConfiguration(fixture.configuration);
  await definition.shared.validateData(fixture.data);

  if (fixture.migration !== undefined) {
    await exerciseMigrations(definition, fixture.migration);
  }

  if (definition.frontend !== undefined) {
    invariant(
      fixture.frontendContext !== undefined,
      "missing frontend fixture",
    );
    const input: InteractiveLayerInput = {
      configuration: fixture.configuration,
      data: fixture.data,
      assets: [],
      opacity: 1,
      visible: true,
    };
    const handle = await definition.frontend.mount(
      fixture.frontendContext,
      input,
    );
    await handle.update({ ...input, opacity: 0.5 });
    await handle.destroy();
  }

  if (definition.assetImport !== undefined) {
    invariant(fixture.asset !== undefined, "missing asset-import fixture");
    const result = await definition.assetImport.importAsset(fixture.asset);
    await definition.shared.validateConfiguration(result.configuration);
    await definition.shared.validateData(result.data);
  }

  if (
    definition.server?.createPreview !== undefined ||
    definition.server?.render !== undefined
  ) {
    invariant(fixture.renderContext !== undefined, "missing render fixture");
    await definition.server.createPreview?.(fixture.renderContext);
    await definition.server.render?.(fixture.renderContext);
  }
}
