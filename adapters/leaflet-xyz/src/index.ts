import {
  MAP_ADAPTER_SDK_VERSION,
  type CreateMapRendererOptions,
  type MapLayerDescriptor,
  type MapRendererEvent,
  type MapRendererFactory,
  type MapRendererInstance,
  type MapRendererManifest,
} from "@maptoy/map-adapter-sdk";
import type * as Leaflet from "leaflet";

export const LEAFLET_XYZ_ADAPTER_ID = "leaflet-xyz";

export const leafletXyzManifest = {
  id: LEAFLET_XYZ_ADAPTER_ID,
  version: "0.0.0",
  sdkVersion: MAP_ADAPTER_SDK_VERSION,
  displayName: "Leaflet XYZ",
  configurationSchema: {
    type: "object",
    additionalProperties: false,
  },
  capabilities: {
    interactive: true,
    layerRendering: true,
    serverExport: true,
    tileArchive: true,
    batchDownload: true,
  },
} satisfies MapRendererManifest;

export interface LeafletXyzConfiguration {
  tileUrl: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
}

type LeafletInstanceCreator = (
  options: CreateMapRendererOptions,
  configuration: LeafletXyzConfiguration,
) => Promise<MapRendererInstance> | MapRendererInstance;

function configuration(value: unknown): LeafletXyzConfiguration {
  if (
    typeof value !== "object" ||
    value === null ||
    !("tileUrl" in value) ||
    typeof value.tileUrl !== "string" ||
    !("attribution" in value) ||
    typeof value.attribution !== "string" ||
    !("minZoom" in value) ||
    typeof value.minZoom !== "number" ||
    !("maxZoom" in value) ||
    typeof value.maxZoom !== "number" ||
    !("tileSize" in value) ||
    (value.tileSize !== 256 && value.tileSize !== 512)
  ) {
    throw new Error("Leaflet XYZ configuration is invalid.");
  }
  return {
    tileUrl: value.tileUrl,
    attribution: value.attribution,
    minZoom: value.minZoom,
    maxZoom: value.maxZoom,
    tileSize: value.tileSize,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

async function createLeafletInstance(
  options: CreateMapRendererOptions,
  leafletConfiguration: LeafletXyzConfiguration,
): Promise<MapRendererInstance> {
  const L = await import("leaflet");
  const map = L.map(options.host, {
    minZoom: leafletConfiguration.minZoom,
    maxZoom: leafletConfiguration.maxZoom,
    zoomSnap: 0.25,
  }).setView(
    [
      options.initialViewport.center.latitude,
      options.initialViewport.center.longitude,
    ],
    options.initialViewport.zoom,
  );
  L.tileLayer(leafletConfiguration.tileUrl, {
    attribution: escapeHtml(leafletConfiguration.attribution),
    minZoom: leafletConfiguration.minZoom,
    maxZoom: leafletConfiguration.maxZoom,
    tileSize: leafletConfiguration.tileSize,
  }).addTo(map);

  const layers = new Map<string, MapLayerDescriptor>();
  const subscriptions = new Set<{
    event: string;
    handler: Leaflet.LeafletEventHandlerFn;
  }>();
  const eventName = (event: MapRendererEvent): string =>
    event === "pointer"
      ? "mousemove"
      : event === "selection"
        ? "click"
        : "moveend";

  return {
    getViewport: () => {
      const center = map.getCenter();
      return {
        center: { longitude: center.lng, latitude: center.lat },
        zoom: map.getZoom(),
      };
    },
    setViewport: (viewport) => {
      map.setView(
        [viewport.center.latitude, viewport.center.longitude],
        viewport.zoom,
      );
    },
    subscribe: (event, listener) => {
      const leafletEvent = eventName(event);
      const handler: Leaflet.LeafletEventHandlerFn = (payload) => {
        if (
          (event === "pointer" || event === "selection") &&
          "latlng" in payload
        ) {
          const latLng = payload.latlng as Leaflet.LatLng;
          listener({
            coordinate: {
              longitude: latLng.lng,
              latitude: latLng.lat,
            },
          });
          return;
        }
        const center = map.getCenter();
        listener({
          viewport: {
            center: { longitude: center.lng, latitude: center.lat },
            zoom: map.getZoom(),
          },
        });
      };
      const subscription = { event: leafletEvent, handler };
      subscriptions.add(subscription);
      map.on(leafletEvent, handler);
      return () => {
        map.off(leafletEvent, handler);
        subscriptions.delete(subscription);
      };
    },
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
    geographicToScreen: ({ longitude, latitude }) => {
      const point = map.latLngToContainerPoint([latitude, longitude]);
      return { x: point.x, y: point.y };
    },
    screenToGeographic: ({ x, y }) => {
      const coordinate = map.containerPointToLatLng([x, y]);
      return { longitude: coordinate.lng, latitude: coordinate.lat };
    },
    destroy: () => {
      for (const { event, handler } of subscriptions) {
        map.off(event, handler);
      }
      subscriptions.clear();
      layers.clear();
      map.remove();
    },
  };
}

export function createLeafletXyzFactory(
  instanceCreator: LeafletInstanceCreator = createLeafletInstance,
): MapRendererFactory {
  return {
    manifest: leafletXyzManifest,
    create: (options) =>
      instanceCreator(options, configuration(options.configuration)),
  };
}

export const leafletXyzFactory = createLeafletXyzFactory();
