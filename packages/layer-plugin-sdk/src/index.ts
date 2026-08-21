export const LAYER_PLUGIN_SDK_VERSION = "1.0.0";

export type MaybePromise<T> = T | Promise<T>;
export type JsonObject = Readonly<Record<string, unknown>>;

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
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
  opacity: number;
  visible: boolean;
}

export interface InteractiveLayerDescriptor {
  type: string;
  data: unknown;
}

export interface LayerPluginFrontendContext {
  instanceId: string;
  publishLayer: (descriptor: InteractiveLayerDescriptor) => void;
  clearLayer: () => void;
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
  project: (coordinate: GeographicCoordinate) => ScreenPoint;
  surface: LayerDrawingSurface;
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
