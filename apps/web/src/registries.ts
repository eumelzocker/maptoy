import { imageLayerPlugin } from "@maptoy/image-layer";
import {
  createLayerPluginRegistry,
  type LayerPluginRegistry,
} from "@maptoy/layer-plugin-sdk";
import { leafletXyzManifest } from "@maptoy/leaflet-xyz";
import {
  createMapRendererManifestRegistry,
  type MapRendererManifestRegistry,
} from "@maptoy/map-adapter-sdk";
import { trackLayerPlugin } from "@maptoy/track-layer";
import type { InjectionKey } from "vue";

export const mapRendererRegistry = createMapRendererManifestRegistry([
  leafletXyzManifest,
]);

export const layerPluginRegistry = createLayerPluginRegistry([
  trackLayerPlugin,
  imageLayerPlugin,
]);

export const MAP_RENDERER_REGISTRY_KEY: InjectionKey<MapRendererManifestRegistry> =
  Symbol("map-renderer-registry");

export const LAYER_PLUGIN_REGISTRY_KEY: InjectionKey<LayerPluginRegistry> =
  Symbol("layer-plugin-registry");
