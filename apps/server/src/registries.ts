import { imageLayerPlugin } from "@maptoy/image-layer";
import { createLayerPluginRegistry } from "@maptoy/layer-plugin-sdk";
import { leafletXyzManifest } from "@maptoy/leaflet-xyz";
import { createMapRendererManifestRegistry } from "@maptoy/map-adapter-sdk";
import { trackLayerPlugin } from "@maptoy/track-layer";

export const mapRendererRegistry = createMapRendererManifestRegistry([
  leafletXyzManifest,
]);

export const layerPluginRegistry = createLayerPluginRegistry([
  trackLayerPlugin,
  imageLayerPlugin,
]);
