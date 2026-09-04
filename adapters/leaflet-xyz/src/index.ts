import {
  type CreateMapRendererOptions,
  MAP_ADAPTER_SDK_VERSION,
  isMapAreaLayerData,
  isMapCompositeLayerData,
  isMapLineLayerData,
  isMapPointLayerData,
  isMapRectangleLayerData,
  isMapXyzTileLayerData,
  isMapXyzTileGridLayerData,
  type MapLayerDescriptor,
  type MapPointFeature,
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
export const MAXIMUM_CLUSTER_POPUP_PHOTOS = 100;

export interface ProjectedPoint<T> {
  x: number;
  y: number;
  value: T;
}

export interface ProjectedPointCluster<T> {
  x: number;
  y: number;
  values: T[];
}

export interface SmartPopupRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SmartPopupPlacement {
  belowAnchor: boolean;
  horizontalShift: number;
  verticalShift: number;
  maximumContentHeight: number;
}

export function smartPopupPlacement(
  popup: SmartPopupRectangle,
  anchor: Readonly<{ x: number; y: number }>,
  viewport: Pick<SmartPopupRectangle, "left" | "top" | "right" | "bottom">,
  markerRadius: number,
  margin = 8,
): SmartPopupPlacement {
  const safeLeft = viewport.left + margin;
  const safeTop = viewport.top + margin;
  const safeRight = viewport.right - margin;
  const safeBottom = viewport.bottom - margin;
  const gap = markerRadius + 12;
  const availableAbove = Math.max(0, anchor.y - gap - safeTop);
  const availableBelow = Math.max(0, safeBottom - anchor.y - gap);
  const belowAnchor =
    popup.height > availableAbove && availableBelow > availableAbove;
  const verticalShift = belowAnchor
    ? anchor.y + gap - popup.top
    : anchor.y - gap - popup.bottom;
  const availableWidth = Math.max(0, safeRight - safeLeft);
  let horizontalShift: number;
  if (popup.width > availableWidth) {
    horizontalShift =
      (safeLeft + safeRight) / 2 - (popup.left + popup.right) / 2;
  } else if (popup.left < safeLeft) {
    horizontalShift = safeLeft - popup.left;
  } else if (popup.right > safeRight) {
    horizontalShift = safeRight - popup.right;
  } else {
    horizontalShift = 0;
  }
  return {
    belowAnchor,
    horizontalShift,
    verticalShift,
    maximumContentHeight: Math.max(
      80,
      Math.floor((belowAnchor ? availableBelow : availableAbove) - 28),
    ),
  };
}

export function clusterProjectedPoints<T>(
  points: readonly ProjectedPoint<T>[],
  radiusPixels: number,
): ProjectedPointCluster<T>[] {
  if (!Number.isFinite(radiusPixels) || radiusPixels <= 0) {
    throw new Error("Cluster radius must be a positive finite number.");
  }
  interface WorkingCluster {
    anchorX: number;
    anchorY: number;
    sumX: number;
    sumY: number;
    values: T[];
  }
  const buckets = new Map<string, WorkingCluster[]>();
  const clusters: WorkingCluster[] = [];
  const cell = (value: number): number => Math.floor(value / radiusPixels);
  const key = (x: number, y: number): string => `${x}:${y}`;

  for (const point of points) {
    const cellX = cell(point.x);
    const cellY = cell(point.y);
    let nearest: WorkingCluster | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (const candidate of buckets.get(
          key(cellX + offsetX, cellY + offsetY),
        ) ?? []) {
          const distance = Math.hypot(
            point.x - candidate.anchorX,
            point.y - candidate.anchorY,
          );
          if (distance <= radiusPixels && distance < nearestDistance) {
            nearest = candidate;
            nearestDistance = distance;
          }
        }
      }
    }
    if (nearest === undefined) {
      const cluster: WorkingCluster = {
        anchorX: point.x,
        anchorY: point.y,
        sumX: point.x,
        sumY: point.y,
        values: [point.value],
      };
      clusters.push(cluster);
      const bucketKey = key(cellX, cellY);
      buckets.set(bucketKey, [...(buckets.get(bucketKey) ?? []), cluster]);
    } else {
      nearest.sumX += point.x;
      nearest.sumY += point.y;
      nearest.values.push(point.value);
    }
  }

  return clusters.map((cluster) => ({
    x: cluster.sumX / cluster.values.length,
    y: cluster.sumY / cluster.values.length,
    values: cluster.values,
  }));
}

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
    "xyz-tile-layer",
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
        : event === "viewport-live"
          ? "move"
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
          weight: feature.strokeWidth ?? 1,
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

  type PopupSource = Leaflet.CircleMarker | Leaflet.Marker;
  const placePopup = (
    source: PopupSource,
    coordinate: Readonly<{ longitude: number; latitude: number }>,
    markerRadius: number,
  ): void => {
    const popup = source.getPopup();
    const element = popup?.getElement();
    if (popup === undefined || element === undefined) return;
    const baseOffset = L.point(0, 7);
    popup.options.offset = baseOffset;
    element.classList.remove("maptoy-smart-popup--below");
    element.style.removeProperty("--maptoy-popup-tip-shift");
    element.style.removeProperty("--maptoy-popup-maximum-height");
    popup.update();

    const mapRectangle = map.getContainer().getBoundingClientRect();
    const popupRectangle = element.getBoundingClientRect();
    const anchorPoint = map.latLngToContainerPoint([
      coordinate.latitude,
      coordinate.longitude,
    ]);
    const placement = smartPopupPlacement(
      popupRectangle,
      {
        x: mapRectangle.left + anchorPoint.x,
        y: mapRectangle.top + anchorPoint.y,
      },
      {
        left: Math.max(0, mapRectangle.left),
        top: Math.max(0, mapRectangle.top),
        right: Math.min(window.innerWidth, mapRectangle.right),
        bottom: Math.min(window.innerHeight, mapRectangle.bottom),
      },
      markerRadius,
    );
    popup.options.offset = L.point(
      baseOffset.x + placement.horizontalShift,
      baseOffset.y + placement.verticalShift,
    );
    element.classList.toggle(
      "maptoy-smart-popup--below",
      placement.belowAnchor,
    );
    element.style.setProperty(
      "--maptoy-popup-tip-shift",
      `${-placement.horizontalShift}px`,
    );
    element.style.setProperty(
      "--maptoy-popup-maximum-height",
      `${placement.maximumContentHeight}px`,
    );
    popup.update();
  };

  const schedulePopupPlacement = (
    source: PopupSource,
    coordinate: Readonly<{ longitude: number; latitude: number }>,
    markerRadius: number,
  ): void => {
    window.requestAnimationFrame(() => {
      placePopup(source, coordinate, markerRadius);
    });
  };

  const createPointMarker = (
    descriptor: MapLayerDescriptor,
    feature: MapPointFeature,
  ): Leaflet.CircleMarker => {
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
    if (feature.previewUrl !== undefined) {
      const popupContent = document.createElement("div");
      popupContent.className = "maptoy-point-popup";
      const preview = document.createElement("img");
      preview.className = "maptoy-point-popup__preview";
      preview.alt = feature.title ?? "";
      preview.loading = "lazy";
      preview.addEventListener("load", () => {
        schedulePopupPlacement(
          point,
          feature.coordinate,
          feature.symbolizer.radius,
        );
      });
      preview.src = feature.previewUrl;
      popupContent.append(preview);
      if (feature.popupLines !== undefined) {
        const details = document.createElement("small");
        details.className = "maptoy-point-popup__details";
        for (const line of feature.popupLines) {
          const detail = document.createElement("span");
          detail.textContent = line;
          details.append(detail);
        }
        popupContent.append(details);
      }
      point.bindPopup(popupContent, {
        autoPan: false,
        closeButton: false,
        className: "maptoy-smart-popup",
      });
      point.on("popupopen", () => {
        schedulePopupPlacement(
          point,
          feature.coordinate,
          feature.symbolizer.radius,
        );
      });
      point.on("mouseover", () => point.openPopup());
      point.on("mouseout", () => point.closePopup());
    } else if (feature.title !== undefined) {
      point.bindTooltip(feature.title, { sticky: true });
    }
    bindFeatureSelection(point, descriptor, feature.id);
    return point;
  };

  const createClusterPopup = (
    features: readonly MapPointFeature[],
    onPreviewLoad: () => void,
  ): HTMLDivElement => {
    const content = document.createElement("div");
    content.className = "maptoy-point-cluster-popup";
    const heading = document.createElement("strong");
    heading.textContent = `${features.length} photos in this cluster`;
    content.append(heading);
    const list = document.createElement("div");
    list.className = "maptoy-point-cluster-popup__list";
    list.setAttribute("role", "list");
    for (const feature of features.slice(0, MAXIMUM_CLUSTER_POPUP_PHOTOS)) {
      const item = document.createElement("article");
      item.className = "maptoy-point-cluster-popup__item";
      item.setAttribute("role", "listitem");
      if (feature.previewUrl !== undefined) {
        const preview = document.createElement("img");
        preview.className = "maptoy-point-cluster-popup__preview";
        preview.alt = feature.title ?? "";
        preview.loading = "lazy";
        preview.addEventListener("load", onPreviewLoad);
        preview.src = feature.previewUrl;
        item.append(preview);
      }
      const details = document.createElement("div");
      details.className = "maptoy-point-cluster-popup__details";
      const title = document.createElement("strong");
      title.textContent = feature.title ?? feature.id;
      details.append(title);
      for (const line of feature.popupLines ?? []) {
        if (line === feature.title) continue;
        const detail = document.createElement("small");
        detail.textContent = line;
        details.append(detail);
      }
      item.append(details);
      list.append(item);
    }
    content.append(list);
    if (features.length > MAXIMUM_CLUSTER_POPUP_PHOTOS) {
      const remainder = document.createElement("small");
      remainder.textContent = `and ${features.length - MAXIMUM_CLUSTER_POPUP_PHOTOS} more`;
      content.append(remainder);
    }
    return content;
  };

  const createClusterMarker = (
    descriptor: MapLayerDescriptor,
    cluster: ProjectedPointCluster<MapPointFeature>,
  ): Leaflet.Marker => {
    const position = map.containerPointToLatLng(L.point(cluster.x, cluster.y));
    const bubble = document.createElement("span");
    bubble.className = "maptoy-point-cluster__count";
    bubble.textContent = String(cluster.values.length);
    bubble.style.backgroundColor =
      cluster.values[0]?.symbolizer.fillColor ?? "#2e77d0";
    const diameter = Math.min(48, 30 + Math.log10(cluster.values.length) * 7);
    const marker = L.marker(position, {
      bubblingMouseEvents: false,
      opacity: descriptor.opacity,
      icon: L.divIcon({
        className: "maptoy-point-cluster",
        html: bubble,
        iconAnchor: [diameter / 2, diameter / 2],
        iconSize: [diameter, diameter],
      }),
    });
    marker.bindTooltip(`${cluster.values.length} photos`, { sticky: true });
    marker.bindPopup(
      createClusterPopup(cluster.values, () => {
        schedulePopupPlacement(
          marker,
          {
            longitude: position.lng,
            latitude: position.lat,
          },
          diameter / 2,
        );
      }),
      {
        autoPan: false,
        className: "maptoy-smart-popup",
        minWidth: 260,
        maxWidth: 460,
      },
    );
    marker.on("popupopen", () => {
      schedulePopupPlacement(
        marker,
        {
          longitude: position.lng,
          latitude: position.lat,
        },
        diameter / 2,
      );
    });
    return marker;
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
    const pointData = descriptor.data;
    const group = L.layerGroup();
    const clustering = pointData.clustering;
    if (clustering?.enabled !== true) {
      for (const feature of pointData.features) {
        createPointMarker(descriptor, feature).addTo(group);
      }
      return group;
    }

    let redrawFrame: number | null = null;
    const redraw = (): void => {
      redrawFrame = null;
      group.clearLayers();
      const zoom = map.getZoom();
      const size = map.getSize();
      const center = map.project(map.getCenter(), zoom);
      const worldWidth = (map.options.crs ?? L.CRS.EPSG3857).scale(zoom);
      const margin = clustering.radiusPixels * 2;
      const projected = pointData.features.flatMap((feature) => {
        const point = map.project(
          L.latLng(feature.coordinate.latitude, feature.coordinate.longitude),
          zoom,
        );
        const wrappedX =
          point.x - Math.round((point.x - center.x) / worldWidth) * worldWidth;
        const screenX = wrappedX - center.x + size.x / 2;
        const screenY = point.y - center.y + size.y / 2;
        return screenX < -margin ||
          screenX > size.x + margin ||
          screenY < -margin ||
          screenY > size.y + margin
          ? []
          : [{ x: screenX, y: screenY, value: feature }];
      });
      for (const cluster of clusterProjectedPoints(
        projected,
        clustering.radiusPixels,
      )) {
        if (cluster.values.length === 1) {
          const feature = cluster.values[0];
          if (feature !== undefined) {
            createPointMarker(descriptor, feature).addTo(group);
          }
        } else {
          createClusterMarker(descriptor, cluster).addTo(group);
        }
      }
    };
    const scheduleRedraw = (): void => {
      if (redrawFrame === null) {
        redrawFrame = window.requestAnimationFrame(redraw);
      }
    };
    group.on("add", () => {
      map.on("moveend", scheduleRedraw);
      map.on("zoomend", scheduleRedraw);
      redraw();
    });
    group.on("remove", () => {
      map.off("moveend", scheduleRedraw);
      map.off("zoomend", scheduleRedraw);
      if (redrawFrame !== null) {
        window.cancelAnimationFrame(redrawFrame);
        redrawFrame = null;
      }
    });
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

  const createXyzTileLayer = (
    descriptor: MapLayerDescriptor,
  ): Leaflet.TileLayer | null => {
    if (
      descriptor.type !== "xyz-tile-layer" ||
      !isMapXyzTileLayerData(descriptor.data)
    ) {
      return null;
    }
    const data = descriptor.data;
    const layerZoomOptions = leafletXyzZoomOptions(data);
    return L.tileLayer(data.tileUrl, {
      minZoom: layerZoomOptions.minZoom,
      maxZoom: layerZoomOptions.maxZoom,
      tileSize: data.tileSize,
      zoomOffset: layerZoomOptions.zoomOffset,
      opacity: descriptor.opacity,
      zIndex: 300,
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
      createXyzTileLayer(descriptor) ??
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

  const bringLayerToFront = (layer: Leaflet.Layer): void => {
    if (layer instanceof L.LayerGroup) {
      layer.eachLayer(bringLayerToFront);
    } else if (layer instanceof L.Path || layer instanceof L.GridLayer) {
      layer.bringToFront();
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
        { animate: false },
      );
    },
    fitBounds: (bounds, fitOptions) => {
      const east = bounds.west > bounds.east ? bounds.east + 360 : bounds.east;
      const padding = L.point(
        fitOptions?.paddingPixels ?? 0,
        fitOptions?.paddingPixels ?? 0,
      );
      map.fitBounds(
        L.latLngBounds([bounds.south, bounds.west], [bounds.north, east]),
        {
          animate: false,
          padding,
          ...(fitOptions?.maximumZoom === undefined
            ? {}
            : { maxZoom: fitOptions.maximumZoom }),
        },
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
    resize: () => {
      map.invalidateSize({ animate: false, pan: false });
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
        if (leafletLayer !== null && leafletLayer !== undefined) {
          bringLayerToFront(leafletLayer);
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
