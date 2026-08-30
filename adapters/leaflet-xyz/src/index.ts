import {
  type CreateMapRendererOptions,
  MAP_ADAPTER_SDK_VERSION,
  isMapAreaLayerData,
  isMapCompositeLayerData,
  isMapLineLayerData,
  isMapPointLayerData,
  isMapRasterOverlayLayerData,
  isMapRectangleLayerData,
  isMapXyzTileGridLayerData,
  type MapLayerDescriptor,
  type MapRendererEvent,
  type MapRendererFactory,
  type MapRendererInstance,
  type MapRendererManifest,
} from "@maptoy/map-adapter-sdk";
import {
  geodesicDistanceMeters,
  type SegmentedMetricScale,
  segmentedMetricScale,
  type TileCoordinate,
  xyzToWgs84,
} from "@maptoy/map-core";
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
  supportedLayerTypes: [
    "rectangle-grid",
    "point-collection",
    "line-collection",
    "area-collection",
    "raster-overlay",
    "xyz-tile-grid",
    "composite",
  ],
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

function leafletXyzSourceTile(
  coordinates: Readonly<{ x: number; y: number; z: number }>,
  zoomOffset: number,
): TileCoordinate {
  const sourceZoom = coordinates.z + zoomOffset;
  const scale = 2 ** sourceZoom;
  const canonicalX = ((coordinates.x % scale) + scale) % scale;
  return { zoom: sourceZoom, x: canonicalX, y: coordinates.y };
}

export function leafletXyzTileLabel(
  coordinates: Readonly<{ x: number; y: number; z: number }>,
  zoomOffset: number,
): string {
  const source = leafletXyzSourceTile(coordinates, zoomOffset);
  return `${source.zoom}/${source.x}/${source.y}`;
}

export interface LeafletXyzTileDecoration {
  label: string;
  scale: SegmentedMetricScale;
}

export interface HorizontalLabelBounds {
  left: number;
  right: number;
}

export function nonOverlappingScaleMarkIndexes(
  bounds: readonly HorizontalLabelBounds[],
  minimumGap = 2,
): readonly number[] {
  const visible: number[] = [];
  let nextVisibleLeft = Number.POSITIVE_INFINITY;
  for (let index = bounds.length - 1; index >= 0; index -= 1) {
    const mark = bounds[index];
    if (
      mark !== undefined &&
      (visible.length === 0 || mark.right + minimumGap <= nextVisibleLeft)
    ) {
      visible.unshift(index);
      nextVisibleLeft = mark.left;
    }
  }
  return visible;
}

export function leafletXyzTileDecoration(
  coordinates: Readonly<{ x: number; y: number; z: number }>,
  zoomOffset: number,
  scaleWidthPercent: number,
): LeafletXyzTileDecoration {
  const source = leafletXyzSourceTile(coordinates, zoomOffset);
  const westernCenter = xyzToWgs84({
    zoom: source.zoom,
    x: source.x,
    y: source.y + 0.5,
  });
  const easternCenter = xyzToWgs84({
    zoom: source.zoom,
    x: source.x + 1,
    y: source.y + 0.5,
  });
  const tileWidthMeters = geodesicDistanceMeters(westernCenter, easternCenter);
  return {
    label: `${source.zoom}/${source.x}/${source.y}`,
    scale: segmentedMetricScale(tileWidthMeters * (scaleWidthPercent / 100)),
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

  interface RenderedLayer {
    descriptor: MapLayerDescriptor;
    leafletLayer: Leaflet.Layer | null;
  }

  const layers = new Map<string, RenderedLayer>();
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

  const createXyzTileGridLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.GridLayer | null => {
    if (
      descriptor.type !== "xyz-tile-grid" ||
      !isMapXyzTileGridLayerData(descriptor.data)
    ) {
      return null;
    }
    const data = descriptor.data;
    class XyzTileGridLayer extends L.GridLayer {
      override createTile(coordinates: Leaflet.Coords): HTMLElement {
        const tile = L.DomUtil.create("div", "maptoy-xyz-tile-grid-cell");
        tile.style.boxSizing = "border-box";
        tile.style.boxShadow = data.showGrid
          ? `inset 0 0 0 1px ${data.lineColor}`
          : "none";
        tile.style.display = "grid";
        tile.style.placeItems = "center";
        tile.style.pointerEvents = "none";
        if (data.showLabels || data.showScale) {
          const decoration = leafletXyzTileDecoration(
            coordinates,
            zoomOptions.zoomOffset,
            data.scaleWidthPercent,
          );
          if (data.showLabels) {
            const label = L.DomUtil.create(
              "span",
              "maptoy-xyz-tile-grid-label",
              tile,
            );
            label.textContent = decoration.label;
            label.style.position = "absolute";
            label.style.left = "50%";
            label.style.top = "calc(50% - 1.35rem)";
            label.style.transform = "translate(-50%, -50%)";
            label.style.padding = "0.15rem 0.3rem";
            label.style.borderRadius = "0.2rem";
            label.style.color = data.textColor;
            label.style.background = data.backgroundColor;
            label.style.font = "600 0.75rem/1.2 ui-monospace, monospace";
            label.style.whiteSpace = "nowrap";
          }
          if (data.showScale) {
            const scale = L.DomUtil.create(
              "div",
              "maptoy-xyz-tile-scale",
              tile,
            );
            scale.style.position = "absolute";
            scale.style.left = "50%";
            scale.style.top = "50%";
            scale.style.width = `${data.scaleWidthPercent}%`;
            scale.style.transform = "translate(-50%, -50%)";
            scale.style.paddingTop = "0.1rem";
            scale.style.borderRadius = "0.15rem";
            scale.style.color = data.textColor;
            scale.style.background = data.backgroundColor;
            scale.style.font = "600 0.55rem/1 ui-monospace, monospace";
            scale.style.whiteSpace = "nowrap";
            const marks = L.DomUtil.create(
              "div",
              "maptoy-xyz-tile-scale-marks",
              scale,
            );
            marks.style.position = "relative";
            marks.style.height = "0.65rem";
            const ticks = L.DomUtil.create(
              "div",
              "maptoy-xyz-tile-scale-ticks",
              scale,
            );
            ticks.style.position = "absolute";
            ticks.style.right = "0";
            ticks.style.bottom = "0.35rem";
            ticks.style.left = "0";
            ticks.style.height = "0.2rem";
            ticks.style.pointerEvents = "none";
            const markElements: HTMLElement[] = [];
            for (const [index, mark] of decoration.scale.marks.entries()) {
              const markElement = L.DomUtil.create(
                "span",
                "maptoy-xyz-tile-scale-label",
                marks,
              );
              markElement.textContent = mark.label;
              markElement.style.position = "absolute";
              markElement.style.left = `${mark.position * 100}%`;
              markElement.style.transform =
                index === decoration.scale.marks.length - 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)";
              markElements.push(markElement);
              const tickElement = L.DomUtil.create(
                "span",
                "maptoy-xyz-tile-scale-tick",
                ticks,
              );
              tickElement.style.position = "absolute";
              tickElement.style.bottom = "0";
              tickElement.style.left = `${mark.position * 100}%`;
              tickElement.style.width = "1px";
              tickElement.style.height = "100%";
              tickElement.style.background = "currentColor";
              tickElement.style.transform = "translateX(-50%)";
            }
            requestAnimationFrame(() => {
              if (!scale.isConnected) {
                return;
              }
              const visibleIndexes = new Set(
                nonOverlappingScaleMarkIndexes(
                  markElements.map((element) =>
                    element.getBoundingClientRect(),
                  ),
                ),
              );
              for (const [index, element] of markElements.entries()) {
                element.hidden = !visibleIndexes.has(index);
              }
            });
            const scaleLine = L.DomUtil.create(
              "div",
              "maptoy-xyz-tile-scale-line",
              scale,
            );
            scaleLine.style.display = "flex";
            scaleLine.style.width = "100%";
            scaleLine.style.height = "0.35rem";
            scaleLine.style.boxSizing = "border-box";
            scaleLine.style.overflow = "hidden";
            scaleLine.style.border = "1px solid #111111";
            for (const section of decoration.scale.sections) {
              const sectionElement = L.DomUtil.create(
                "span",
                "maptoy-xyz-tile-scale-section",
                scaleLine,
              );
              sectionElement.style.flex = `0 0 ${section.width * 100}%`;
              sectionElement.style.background = section.dark
                ? "#111111"
                : "#ffffff";
            }
          }
        }
        return tile;
      }
    }
    return new XyzTileGridLayer({
      tileSize: leafletConfiguration.tileSize,
      opacity: descriptor.opacity,
      updateWhenZooming: true,
      updateWhenIdle: false,
      zIndex: 500,
    });
  };

  const createDescriptorLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.Layer | null => {
    if (
      descriptor.type === "composite" &&
      isMapCompositeLayerData(descriptor.data)
    ) {
      const group = L.layerGroup();
      for (const data of descriptor.data.layers) {
        const child = createDescriptorLayer({
          ...descriptor,
          type: data.kind,
          data,
        });
        if (child !== null) {
          group.addLayer(child);
        }
      }
      return group;
    }
    return (
      createRectangleLayer(descriptor) ??
      createPointLayer(descriptor) ??
      createLineLayer(descriptor) ??
      createAreaLayer(descriptor) ??
      createRasterOverlayLayer(descriptor) ??
      createXyzTileGridLayer(descriptor)
    );
  };

  const removeRenderedLayer = (rendered: RenderedLayer): void => {
    rendered.leafletLayer?.removeFrom(map);
  };

  const replaceLayer = (descriptor: MapLayerDescriptor): void => {
    const previous = layers.get(descriptor.id);
    if (previous !== undefined) {
      removeRenderedLayer(previous);
    }
    const rendered = {
      descriptor,
      leafletLayer: createDescriptorLayer(descriptor),
    };
    layers.set(descriptor.id, rendered);
    if (descriptor.visible) {
      rendered.leafletLayer?.addTo(map);
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
        if (leafletLayer instanceof L.LayerGroup) {
          leafletLayer.eachLayer((child: Leaflet.Layer) => {
            if (child instanceof L.Path || child instanceof L.GridLayer) {
              child.bringToFront();
            }
          });
        } else if (leafletLayer instanceof L.GridLayer) {
          leafletLayer.bringToFront();
        }
      }
    },
    removeLayer: (layerId) => {
      const rendered = layers.get(layerId);
      if (rendered !== undefined) {
        removeRenderedLayer(rendered);
      }
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
      for (const rendered of layers.values()) {
        removeRenderedLayer(rendered);
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
