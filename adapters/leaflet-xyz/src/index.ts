import {
  type CreateMapRendererOptions,
  MAP_ADAPTER_SDK_VERSION,
  isMapAreaLayerData,
  isMapCompositeLayerData,
  isMapLineLayerData,
  isMapPointLayerData,
  isMapRasterOverlayLayerData,
  isMapRectangleLayerData,
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
  zoomControl: boolean;
}

export function leafletXyzZoomOptions(
  value: Pick<LeafletXyzConfiguration, "minZoom" | "maxZoom" | "tileSize">,
): { minZoom: number; maxZoom: number; zoomOffset: number } {
  // A 512 px provider Tile at z covers the same area as a 256 px Tile at z,
  // but contains the detail of display zoom z + 1. Leaflet therefore needs a
  // one-level URL offset while its viewport remains on the visual zoom scale.
  const displayZoomOffset = value.tileSize === 512 ? 1 : 0;
  return {
    minZoom: value.minZoom + displayZoomOffset,
    maxZoom: value.maxZoom + displayZoomOffset,
    zoomOffset: displayZoomOffset === 0 ? 0 : -displayZoomOffset,
  };
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
    (value.tileSize !== 256 && value.tileSize !== 512) ||
    ("zoomControl" in value && typeof value.zoomControl !== "boolean")
  ) {
    throw new Error("Leaflet XYZ configuration is invalid.");
  }
  return {
    tileUrl: value.tileUrl,
    attribution: value.attribution,
    minZoom: value.minZoom,
    maxZoom: value.maxZoom,
    tileSize: value.tileSize,
    zoomControl:
      "zoomControl" in value && typeof value.zoomControl === "boolean"
        ? value.zoomControl
        : true,
  };
}

async function createLeafletInstance(
  options: CreateMapRendererOptions,
  leafletConfiguration: LeafletXyzConfiguration,
): Promise<MapRendererInstance> {
  const L = await import("leaflet");
  const zoomOptions = leafletXyzZoomOptions(leafletConfiguration);
  const map = L.map(options.host, {
    minZoom: zoomOptions.minZoom,
    maxZoom: zoomOptions.maxZoom,
    zoomSnap: 0.25,
    zoomControl: leafletConfiguration.zoomControl,
    worldCopyJump: true,
  }).setView(
    [
      options.initialViewport.center.latitude,
      options.initialViewport.center.longitude,
    ],
    options.initialViewport.zoom,
  );
  L.tileLayer(leafletConfiguration.tileUrl, {
    // Leaflet intentionally renders attribution as HTML. Map Sets are trusted,
    // administrator-authored configuration in this single-user application, so
    // links are passed through unchanged instead of applying XSS sanitization.
    attribution: leafletConfiguration.attribution,
    minZoom: zoomOptions.minZoom,
    maxZoom: zoomOptions.maxZoom,
    tileSize: leafletConfiguration.tileSize,
    zoomOffset: zoomOptions.zoomOffset,
  }).addTo(map);

  const layers = new Map<
    string,
    { descriptor: MapLayerDescriptor; leafletLayer: Leaflet.LayerGroup | null }
  >();
  const selectionListeners = new Set<(payload: unknown) => void>();
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

  const createRectangleLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type !== "rectangle-grid" ||
      !isMapRectangleLayerData(descriptor.data)
    ) {
      return null;
    }
    const group = L.layerGroup();
    for (const feature of descriptor.data.features) {
      const rectangle = L.rectangle(
        [
          [feature.bounds.south, feature.bounds.west],
          [feature.bounds.north, feature.bounds.east],
        ],
        {
          color: feature.strokeColor,
          weight: 1,
          opacity: descriptor.opacity,
          fillColor: feature.fillColor,
          fillOpacity: feature.fillOpacity * descriptor.opacity,
          bubblingMouseEvents: false,
        },
      );
      if (feature.label !== undefined) {
        rectangle.bindTooltip(feature.label, { sticky: true });
      }
      rectangle.on("click", (event) => {
        for (const listener of selectionListeners) {
          listener({
            layerId: descriptor.id,
            featureId: feature.id,
            coordinate: {
              longitude: event.latlng.lng,
              latitude: event.latlng.lat,
            },
          });
        }
      });
      rectangle.addTo(group);
    }
    return group;
  };

  const bindFeatureSelection = (
    layer: Leaflet.Layer,
    descriptor: MapLayerDescriptor,
    featureId: string,
  ): void => {
    layer.on("click", (event: Leaflet.LeafletMouseEvent) => {
      for (const listener of selectionListeners) {
        listener({
          layerId: descriptor.id,
          featureId,
          coordinate: {
            longitude: event.latlng.lng,
            latitude: event.latlng.lat,
          },
        });
      }
    });
  };

  const createPointLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type !== "point-collection" ||
      !isMapPointLayerData(descriptor.data)
    ) {
      return null;
    }
    const group = L.layerGroup();
    for (const feature of descriptor.data.features) {
      const point = L.circleMarker(
        [feature.coordinate.latitude, feature.coordinate.longitude],
        {
          radius: feature.symbolizer.radius,
          color: feature.symbolizer.strokeColor,
          weight: feature.symbolizer.strokeWidth,
          fillColor: feature.symbolizer.fillColor,
          fillOpacity: feature.symbolizer.fillOpacity * descriptor.opacity,
          opacity: descriptor.opacity,
          bubblingMouseEvents: false,
        },
      );
      if (feature.title !== undefined) {
        point.bindTooltip(feature.title, { sticky: true });
      }
      if (feature.previewUrl !== undefined) {
        const preview = document.createElement("img");
        preview.src = feature.previewUrl;
        preview.alt = feature.title ?? "";
        preview.loading = "lazy";
        preview.style.maxWidth = "18rem";
        preview.style.maxHeight = "14rem";
        point.bindPopup(preview);
      }
      bindFeatureSelection(point, descriptor, feature.id);
      point.addTo(group);
    }
    return group;
  };

  const createLineLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type !== "line-collection" ||
      !isMapLineLayerData(descriptor.data)
    ) {
      return null;
    }
    const group = L.layerGroup();
    for (const feature of descriptor.data.features) {
      const line = L.polyline(
        feature.coordinates.map(
          ({ latitude, longitude }) =>
            [latitude, longitude] as [number, number],
        ),
        {
          color: feature.symbolizer.color,
          weight: feature.symbolizer.width,
          opacity: feature.symbolizer.opacity * descriptor.opacity,
          dashArray: feature.symbolizer.dashArray,
          bubblingMouseEvents: false,
        },
      );
      if (feature.title !== undefined) {
        line.bindTooltip(feature.title, { sticky: true });
      }
      bindFeatureSelection(line, descriptor, feature.id);
      line.addTo(group);
    }
    return group;
  };

  const createAreaLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type !== "area-collection" ||
      !isMapAreaLayerData(descriptor.data)
    ) {
      return null;
    }
    const group = L.layerGroup();
    for (const feature of descriptor.data.features) {
      const area = L.polygon(
        feature.rings.map((ring) =>
          ring.map(
            ({ latitude, longitude }) =>
              [latitude, longitude] as [number, number],
          ),
        ),
        {
          color: feature.symbolizer.strokeColor,
          weight: feature.symbolizer.strokeWidth,
          opacity: feature.symbolizer.strokeOpacity * descriptor.opacity,
          fillColor: feature.symbolizer.fillColor,
          fillOpacity: feature.symbolizer.fillOpacity * descriptor.opacity,
          bubblingMouseEvents: false,
        },
      );
      if (feature.title !== undefined) {
        area.bindTooltip(feature.title, { sticky: true });
      }
      bindFeatureSelection(area, descriptor, feature.id);
      area.addTo(group);
    }
    return group;
  };

  const createRasterOverlayLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type !== "raster-overlay" ||
      !isMapRasterOverlayLayerData(descriptor.data)
    ) {
      return null;
    }
    const group = L.layerGroup();
    for (const feature of descriptor.data.features) {
      const overlay = L.imageOverlay(
        feature.imageUrl,
        [
          [feature.bounds.south, feature.bounds.west],
          [feature.bounds.north, feature.bounds.east],
        ],
        {
          opacity: descriptor.opacity,
          interactive: true,
        },
      );
      if (feature.title !== undefined) {
        overlay.bindTooltip(feature.title, { sticky: true });
      }
      bindFeatureSelection(overlay, descriptor, feature.id);
      overlay.addTo(group);
    }
    return group;
  };

  const createDescriptorLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.LayerGroup | null => {
    if (
      descriptor.type === "composite" &&
      isMapCompositeLayerData(descriptor.data)
    ) {
      const group = L.layerGroup();
      for (const data of descriptor.data.layers) {
        createDescriptorLayer({
          ...descriptor,
          type: data.kind,
          data,
        })?.addTo(group);
      }
      return group;
    }
    return (
      createRectangleLayer(descriptor) ??
      createPointLayer(descriptor) ??
      createLineLayer(descriptor) ??
      createAreaLayer(descriptor) ??
      createRasterOverlayLayer(descriptor)
    );
  };

  const replaceLayer = (descriptor: MapLayerDescriptor): void => {
    const previous = layers.get(descriptor.id);
    if (
      previous?.leafletLayer !== null &&
      previous?.leafletLayer !== undefined
    ) {
      previous.leafletLayer.removeFrom(map);
    }
    const leafletLayer = createDescriptorLayer(descriptor);
    layers.set(descriptor.id, { descriptor, leafletLayer });
    if (descriptor.visible && leafletLayer !== null) {
      leafletLayer.addTo(map);
    }
  };

  return {
    getViewport: () => {
      const center = map.wrapLatLng(map.getCenter());
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
    setZoomRange: ({ minimum, maximum }) => {
      if (minimum > maximum) {
        throw new Error("Map renderer zoom range is invalid.");
      }
      map.setMinZoom(minimum);
      map.setMaxZoom(maximum);
      const zoom = map.getZoom();
      if (zoom < minimum || zoom > maximum) {
        map.setZoom(Math.min(maximum, Math.max(minimum, zoom)), {
          animate: false,
        });
      }
    },
    setAttributionVisible: (visible) => {
      if (visible) {
        map.attributionControl.addTo(map);
      } else {
        map.attributionControl.remove();
      }
    },
    subscribe: (event, listener) => {
      if (event === "selection") {
        selectionListeners.add(listener);
      }
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
        const center = map.wrapLatLng(map.getCenter());
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
        if (event === "selection") {
          selectionListeners.delete(listener);
        }
      };
    },
    attachLayer: (layer) => {
      replaceLayer(layer);
    },
    updateLayer: (layer) => {
      if (!layers.has(layer.id)) {
        throw new Error("Layer is not attached.");
      }
      replaceLayer(layer);
    },
    reorderLayers: (layerIds) => {
      if (layerIds.some((id) => !layers.has(id))) {
        throw new Error("Unknown layer in order.");
      }
      for (const layerId of layerIds) {
        const leafletLayer = layers.get(layerId)?.leafletLayer;
        leafletLayer?.eachLayer((child) => {
          if (child instanceof L.Path) {
            child.bringToFront();
          }
        });
      }
    },
    removeLayer: (layerId) => {
      layers.get(layerId)?.leafletLayer?.removeFrom(map);
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
      selectionListeners.clear();
      for (const { leafletLayer } of layers.values()) {
        leafletLayer?.removeFrom(map);
      }
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
