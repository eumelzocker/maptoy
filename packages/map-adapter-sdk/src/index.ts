export const MAP_ADAPTER_SDK_VERSION = "2.3.0";

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

export interface MapZoomRange {
  minimum: number;
  maximum: number;
}

export interface MapRendererCapabilities {
  interactive: boolean;
  layerRendering: boolean;
  serverExport: boolean;
  tileArchive: boolean;
  batchDownload: boolean;
}

export interface MapRendererManifest {
  id: string;
  version: string;
  sdkVersion: string;
  displayName: string;
  configurationSchema: Readonly<Record<string, unknown>>;
  capabilities: MapRendererCapabilities;
  supportedLayerTypes: readonly MapLayerType[];
}

export type MapLayerType =
  | "rectangle-grid"
  | "point-collection"
  | "line-collection"
  | "area-collection"
  | "xyz-tile-layer"
  | "xyz-tile-grid"
  | "composite";

export interface MapLayerDescriptor {
  id: string;
  type: string;
  visible: boolean;
  opacity: number;
  data: unknown;
}

export interface MapGeographicBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapFitBoundsOptions {
  paddingPixels?: number;
  maximumZoom?: number;
}

export interface MapRectangleFeature {
  id: string;
  bounds: MapGeographicBounds;
  fillColor: string;
  strokeColor: string;
  strokeWidth?: number;
  fillOpacity: number;
  label?: string;
}

export interface MapRectangleLayerData {
  kind: "rectangle-grid";
  features: readonly MapRectangleFeature[];
}

export interface MapPointSymbolizer {
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fillOpacity: number;
}

export interface MapPointFeature {
  id: string;
  coordinate: GeographicCoordinate;
  title?: string;
  previewUrl?: string;
  popupLines?: readonly string[];
  symbolizer: MapPointSymbolizer;
}

export interface MapPointLayerData {
  kind: "point-collection";
  features: readonly MapPointFeature[];
  clustering?: Readonly<{
    enabled: boolean;
    radiusPixels: number;
  }>;
}

export interface MapLineSymbolizer {
  color: string;
  width: number;
  opacity: number;
  dashArray?: string;
}

export interface MapLineFeature {
  id: string;
  coordinates: readonly GeographicCoordinate[];
  title?: string;
  symbolizer: MapLineSymbolizer;
}

export interface MapLineLayerData {
  kind: "line-collection";
  features: readonly MapLineFeature[];
}

export interface MapAreaSymbolizer {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
}

export interface MapAreaFeature {
  id: string;
  rings: readonly (readonly GeographicCoordinate[])[];
  title?: string;
  symbolizer: MapAreaSymbolizer;
}

export interface MapAreaLayerData {
  kind: "area-collection";
  features: readonly MapAreaFeature[];
}

export interface MapXyzTileGridLayerData {
  kind: "xyz-tile-grid";
  lineColor: string;
  textColor: string;
  backgroundColor: string;
  showGrid: boolean;
  showLabels: boolean;
  showScale: boolean;
  scaleWidthPercent: number;
}

export interface MapXyzTileLayerData {
  kind: "xyz-tile-layer";
  tileUrl: string;
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
}

export type MapPrimitiveLayerData =
  | MapRectangleLayerData
  | MapPointLayerData
  | MapLineLayerData
  | MapAreaLayerData
  | MapXyzTileLayerData
  | MapXyzTileGridLayerData;

export interface MapCompositeLayerData {
  kind: "composite";
  layers: readonly MapPrimitiveLayerData[];
}

export type MapSupportedLayerData =
  | MapPrimitiveLayerData
  | MapCompositeLayerData;

function hasKind(value: unknown, kind: MapPrimitiveLayerData["kind"]): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === kind &&
    "features" in value &&
    Array.isArray(value.features)
  );
}

export function isMapRectangleLayerData(
  value: unknown,
): value is MapRectangleLayerData {
  return hasKind(value, "rectangle-grid");
}

export function isMapPointLayerData(
  value: unknown,
): value is MapPointLayerData {
  return hasKind(value, "point-collection");
}

export function isMapLineLayerData(value: unknown): value is MapLineLayerData {
  return hasKind(value, "line-collection");
}

export function isMapAreaLayerData(value: unknown): value is MapAreaLayerData {
  return hasKind(value, "area-collection");
}

export function isMapXyzTileLayerData(
  value: unknown,
): value is MapXyzTileLayerData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "xyz-tile-layer" &&
    "tileUrl" in value &&
    typeof value.tileUrl === "string" &&
    "minZoom" in value &&
    typeof value.minZoom === "number" &&
    Number.isFinite(value.minZoom) &&
    value.minZoom >= 0 &&
    "maxZoom" in value &&
    typeof value.maxZoom === "number" &&
    Number.isFinite(value.maxZoom) &&
    value.maxZoom >= value.minZoom &&
    "tileSize" in value &&
    (value.tileSize === 256 || value.tileSize === 512)
  );
}

export function isMapXyzTileGridLayerData(
  value: unknown,
): value is MapXyzTileGridLayerData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "xyz-tile-grid" &&
    "lineColor" in value &&
    typeof value.lineColor === "string" &&
    "textColor" in value &&
    typeof value.textColor === "string" &&
    "backgroundColor" in value &&
    typeof value.backgroundColor === "string" &&
    "showGrid" in value &&
    typeof value.showGrid === "boolean" &&
    "showLabels" in value &&
    typeof value.showLabels === "boolean" &&
    "showScale" in value &&
    typeof value.showScale === "boolean" &&
    "scaleWidthPercent" in value &&
    typeof value.scaleWidthPercent === "number" &&
    Number.isFinite(value.scaleWidthPercent) &&
    value.scaleWidthPercent >= 25 &&
    value.scaleWidthPercent <= 100
  );
}

export function isMapCompositeLayerData(
  value: unknown,
): value is MapCompositeLayerData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "composite" &&
    "layers" in value &&
    Array.isArray(value.layers)
  );
}

export type MapRendererEvent =
  | "pointer"
  | "selection"
  | "viewport"
  | "viewport-live";
export type MapRendererEventListener = (payload: unknown) => void;
export type Unsubscribe = () => void;

export interface MapRendererInstance {
  getViewport: () => MapViewport;
  setViewport: (viewport: MapViewport) => MaybePromise<void>;
  fitBounds?: (
    bounds: MapGeographicBounds,
    options?: MapFitBoundsOptions,
  ) => MaybePromise<void>;
  setZoomRange?: (range: MapZoomRange) => MaybePromise<void>;
  resize?: () => MaybePromise<void>;
  subscribe: (
    event: MapRendererEvent,
    listener: MapRendererEventListener,
  ) => Unsubscribe;
  attachLayer: (layer: MapLayerDescriptor) => MaybePromise<void>;
  updateLayer: (layer: MapLayerDescriptor) => MaybePromise<void>;
  reorderLayers: (layerIds: readonly string[]) => MaybePromise<void>;
  removeLayer: (layerId: string) => MaybePromise<void>;
  setAttributionVisible: (visible: boolean) => MaybePromise<void>;
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

export interface MapRendererFactoryRegistry {
  get: (id: string) => MapRendererFactory | undefined;
  list: () => readonly MapRendererFactory[];
}

export function createMapRendererFactoryRegistry(
  factories: readonly MapRendererFactory[],
): MapRendererFactoryRegistry {
  const byId = new Map<string, MapRendererFactory>();
  for (const factory of factories) {
    assertValidMapRendererManifest(factory.manifest);
    invariant(
      !byId.has(factory.manifest.id),
      `duplicate adapter id: ${factory.manifest.id}`,
    );
    byId.set(factory.manifest.id, factory);
  }
  const registered = Object.freeze([...byId.values()]);
  return Object.freeze({
    get: (id: string) => byId.get(id),
    list: () => registered,
  });
}

export function createFakeMapRendererFactory(): MapRendererFactory {
  return {
    manifest: {
      id: "fake",
      version: "1.0.0",
      sdkVersion: MAP_ADAPTER_SDK_VERSION,
      displayName: "Contract fake",
      configurationSchema: { type: "object" },
      capabilities: {
        interactive: true,
        layerRendering: true,
        serverExport: false,
        tileArchive: false,
        batchDownload: false,
      },
      supportedLayerTypes: [
        "rectangle-grid",
        "point-collection",
        "line-collection",
        "area-collection",
        "xyz-tile-layer",
        "xyz-tile-grid",
        "composite",
      ],
    },
    create(options): MapRendererInstance {
      let viewport: MapViewport = options.initialViewport;
      let zoomRange: MapZoomRange | null = null;
      const layers = new Map<string, MapLayerDescriptor>();
      return {
        getViewport: () => viewport,
        setViewport: (value) => {
          viewport = {
            ...value,
            zoom:
              zoomRange === null
                ? value.zoom
                : Math.min(
                    zoomRange.maximum,
                    Math.max(zoomRange.minimum, value.zoom),
                  ),
          };
        },
        fitBounds: (bounds, fitOptions) => {
          const east =
            bounds.west > bounds.east ? bounds.east + 360 : bounds.east;
          const longitude = (bounds.west + east) / 2;
          viewport = {
            center: {
              longitude: longitude > 180 ? longitude - 360 : longitude,
              latitude: (bounds.south + bounds.north) / 2,
            },
            zoom: Math.min(
              viewport.zoom,
              fitOptions?.maximumZoom ?? viewport.zoom,
            ),
          };
        },
        setZoomRange: (value) => {
          invariant(value.minimum <= value.maximum, "invalid zoom range");
          zoomRange = value;
          viewport = {
            ...viewport,
            zoom: Math.min(
              value.maximum,
              Math.max(value.minimum, viewport.zoom),
            ),
          };
        },
        resize: () => undefined,
        subscribe: () => () => undefined,
        attachLayer: (layer) => {
          layers.set(layer.id, layer);
        },
        updateLayer: (layer) => {
          if (!layers.has(layer.id)) {
            throw new Error("Layer is not attached.");
          }
          layers.set(layer.id, layer);
        },
        reorderLayers: (layerIds) => {
          if (layerIds.some((id) => !layers.has(id))) {
            throw new Error("Unknown layer in order.");
          }
        },
        removeLayer: (layerId) => {
          layers.delete(layerId);
        },
        setAttributionVisible: () => undefined,
        geographicToScreen: ({ longitude, latitude }) => ({
          x: longitude,
          y: latitude,
        }),
        screenToGeographic: ({ x, y }) => ({ longitude: x, latitude: y }),
        destroy: () => {
          layers.clear();
        },
      };
    },
  };
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
  invariant(
    new Set(manifest.supportedLayerTypes).size ===
      manifest.supportedLayerTypes.length,
    "duplicate supported Layer type",
  );
  invariant(
    manifest.capabilities.layerRendering ||
      manifest.supportedLayerTypes.length === 0,
    "Layer types require Layer rendering capability",
  );
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
  if (instance.fitBounds !== undefined) {
    await instance.fitBounds(
      { west: 170, south: -10, east: -170, north: 10 },
      { paddingPixels: 24, maximumZoom: 8 },
    );
    invariant(
      instance.getViewport().zoom <= 8,
      "fit bounds ignored maximum zoom",
    );
  }
  await instance.resize?.();

  const unsubscribe = instance.subscribe("viewport", () => undefined);
  invariant(typeof unsubscribe === "function", "subscribe must return cleanup");
  unsubscribe();
  const unsubscribeLive = instance.subscribe("viewport-live", () => undefined);
  invariant(
    typeof unsubscribeLive === "function",
    "live viewport subscribe must return cleanup",
  );
  unsubscribeLive();

  const layerData: readonly MapSupportedLayerData[] = [
    { kind: "point-collection", features: [] },
    { kind: "line-collection", features: [] },
    { kind: "area-collection", features: [] },
    {
      kind: "xyz-tile-layer",
      tileUrl: "api/map-sets/labels/tiles/{z}/{x}/{y}",
      minZoom: 0,
      maxZoom: 18,
      tileSize: 256,
    },
    {
      kind: "xyz-tile-grid",
      lineColor: "#000000",
      textColor: "#000000",
      backgroundColor: "#ffffff",
      showGrid: true,
      showLabels: true,
      showScale: true,
      scaleWidthPercent: 75,
    },
    {
      kind: "composite",
      layers: [
        { kind: "point-collection", features: [] },
        { kind: "area-collection", features: [] },
      ],
    },
  ];
  const layerIds: string[] = [];
  for (const [index, data] of layerData.entries()) {
    const layer: MapLayerDescriptor = {
      id: `contract-layer-${index}`,
      type: data.kind,
      visible: true,
      opacity: 0.75,
      data,
    };
    await instance.attachLayer(layer);
    await instance.updateLayer({ ...layer, opacity: 0.5 });
    layerIds.push(layer.id);
  }
  await instance.reorderLayers(layerIds.toReversed());
  for (const layerId of layerIds) {
    await instance.removeLayer(layerId);
  }

  await instance.setAttributionVisible(false);
  await instance.setAttributionVisible(true);

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
