import { imageLayerPlugin } from "@maptoy/image-layer";
import {
  createLayerPluginRegistry,
  type LayerPluginRegistry,
} from "@maptoy/layer-plugin-sdk";
import { leafletXyzFactory, leafletXyzManifest } from "@maptoy/leaflet-xyz";
import {
  createMapRendererFactoryRegistry,
  createMapRendererManifestRegistry,
  type MapRendererFactoryRegistry,
  type MapRendererManifestRegistry,
} from "@maptoy/map-adapter-sdk";
import { tileGridLayerPlugin } from "@maptoy/tile-grid-layer";
import { trackLayerPlugin } from "@maptoy/track-layer";
import type { InjectionKey } from "vue";

export const mapRendererRegistry = createMapRendererManifestRegistry([
  leafletXyzManifest,
]);

export const mapRendererFactoryRegistry = createMapRendererFactoryRegistry([
  leafletXyzFactory,
]);

export const layerPluginRegistry = createLayerPluginRegistry([
  trackLayerPlugin,
  imageLayerPlugin,
  tileGridLayerPlugin,
]);

export const MAP_RENDERER_REGISTRY_KEY: InjectionKey<MapRendererManifestRegistry> =
  Symbol("map-renderer-registry");

export const MAP_RENDERER_FACTORY_REGISTRY_KEY: InjectionKey<MapRendererFactoryRegistry> =
  Symbol("map-renderer-factory-registry");

export const LAYER_PLUGIN_REGISTRY_KEY: InjectionKey<LayerPluginRegistry> =
  Symbol("layer-plugin-registry");
