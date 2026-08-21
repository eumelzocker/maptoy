export const MAP_ADAPTER_SDK_VERSION = "1.0.0";

export type MaybePromise<T> = T | Promise<T>;

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface MapViewport {
  center: GeographicCoordinate;
  zoom: number;
}

export interface MapRendererCapabilities {
  interactive: boolean;
  layerRendering: boolean;
  serverExport: boolean;
  tileArchive: boolean;
}

export interface MapRendererManifest {
  id: string;
  version: string;
  sdkVersion: string;
  displayName: string;
  configurationSchema: Readonly<Record<string, unknown>>;
  capabilities: MapRendererCapabilities;
}

export interface MapLayerDescriptor {
  id: string;
  type: string;
  visible: boolean;
  opacity: number;
  data: unknown;
}

export type MapRendererEvent = "pointer" | "selection" | "viewport";
export type MapRendererEventListener = (payload: unknown) => void;
export type Unsubscribe = () => void;

export interface MapRendererInstance {
  getViewport: () => MapViewport;
  setViewport: (viewport: MapViewport) => MaybePromise<void>;
  subscribe: (
    event: MapRendererEvent,
    listener: MapRendererEventListener,
  ) => Unsubscribe;
  attachLayer: (layer: MapLayerDescriptor) => MaybePromise<void>;
  updateLayer: (layer: MapLayerDescriptor) => MaybePromise<void>;
  reorderLayers: (layerIds: readonly string[]) => MaybePromise<void>;
  removeLayer: (layerId: string) => MaybePromise<void>;
  geographicToScreen: (coordinate: GeographicCoordinate) => ScreenPoint;
  screenToGeographic: (point: ScreenPoint) => GeographicCoordinate;
  destroy: () => MaybePromise<void>;
}

export interface CreateMapRendererOptions {
  host: HTMLElement;
  initialViewport: MapViewport;
  configuration: unknown;
}

export interface MapRendererFactory {
  manifest: MapRendererManifest;
  create: (
    options: CreateMapRendererOptions,
  ) => MaybePromise<MapRendererInstance>;
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Map renderer contract violation: ${message}`);
  }
}

function isSemanticVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function assertValidMapRendererManifest(
  manifest: MapRendererManifest,
): void {
  invariant(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id),
    `invalid adapter id: ${manifest.id}`,
  );
  invariant(isSemanticVersion(manifest.version), "invalid adapter version");
  invariant(
    manifest.sdkVersion === MAP_ADAPTER_SDK_VERSION,
    `unsupported SDK version: ${manifest.sdkVersion}`,
  );
  invariant(manifest.displayName.trim().length > 0, "empty display name");
}

export interface MapRendererManifestRegistry {
  get: (id: string) => MapRendererManifest | undefined;
  list: () => readonly MapRendererManifest[];
}

export function createMapRendererManifestRegistry(
  manifests: readonly MapRendererManifest[],
): MapRendererManifestRegistry {
  const byId = new Map<string, MapRendererManifest>();
  for (const manifest of manifests) {
    assertValidMapRendererManifest(manifest);
    invariant(!byId.has(manifest.id), `duplicate adapter id: ${manifest.id}`);
    byId.set(manifest.id, Object.freeze(manifest));
  }
  const registered = Object.freeze([...byId.values()]);
  return Object.freeze({
    get: (id: string) => byId.get(id),
    list: () => registered,
  });
}

export interface MapRendererContractFixture {
  host: HTMLElement;
  configuration: unknown;
}

export async function exerciseMapRendererContract(
  factory: MapRendererFactory,
  fixture: MapRendererContractFixture,
): Promise<void> {
  assertValidMapRendererManifest(factory.manifest);
  const initialViewport: MapViewport = {
    center: { longitude: 13.405, latitude: 52.52 },
    zoom: 12,
  };
  const instance = await factory.create({
    host: fixture.host,
    configuration: fixture.configuration,
    initialViewport,
  });
  const nextViewport: MapViewport = {
    center: { longitude: 100.5018, latitude: 13.7563 },
    zoom: 9,
  };
  await instance.setViewport(nextViewport);
  invariant(
    JSON.stringify(instance.getViewport()) === JSON.stringify(nextViewport),
    "viewport does not round-trip",
  );

  const unsubscribe = instance.subscribe("viewport", () => undefined);
  invariant(typeof unsubscribe === "function", "subscribe must return cleanup");
  unsubscribe();

  const layer: MapLayerDescriptor = {
    id: "contract-layer",
    type: "fixture",
    visible: true,
    opacity: 0.75,
    data: { fixture: true },
  };
  await instance.attachLayer(layer);
  await instance.updateLayer({ ...layer, opacity: 0.5 });
  await instance.reorderLayers([layer.id]);
  await instance.removeLayer(layer.id);

  const coordinate = { longitude: 13.4, latitude: 52.5 };
  const roundTrip = instance.screenToGeographic(
    instance.geographicToScreen(coordinate),
  );
  invariant(
    Math.abs(roundTrip.longitude - coordinate.longitude) < 1e-9 &&
      Math.abs(roundTrip.latitude - coordinate.latitude) < 1e-9,
    "coordinate conversion does not round-trip",
  );
  await instance.destroy();
}
