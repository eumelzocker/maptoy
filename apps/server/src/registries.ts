import { photoLayerPlugin } from "@maptoy/photo-layer";
import { createLayerPluginRegistry } from "@maptoy/layer-plugin-sdk";
import { leafletXyzManifest } from "@maptoy/leaflet-xyz";
import { mapSetLayerPlugin } from "@maptoy/map-set-layer";
import { createMapRendererManifestRegistry } from "@maptoy/map-adapter-sdk";
import { tileGridLayerPlugin } from "@maptoy/tile-grid-layer";
import { trackLayerPlugin } from "@maptoy/track-layer";

export const mapRendererRegistry = createMapRendererManifestRegistry([
  leafletXyzManifest,
]);

export const layerPluginRegistry = createLayerPluginRegistry([
  mapSetLayerPlugin,
  trackLayerPlugin,
  photoLayerPlugin,
  tileGridLayerPlugin,
]);
