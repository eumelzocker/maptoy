import type { Component } from "vue";
import PhotoLayerPluginEditor from "./components/PhotoLayerPluginEditor.vue";
import SchemaLayerEditor from "./components/SchemaLayerEditor.vue";
import TrackLayerPluginEditor from "./components/TrackLayerPluginEditor.vue";

interface LayerTypePresentation {
  icon: string;
  defaultName: string;
  editor: Component;
}

const presentations = new Map<string, LayerTypePresentation>([
  [
    "track-layer",
    {
      icon: "mdi-vector-polyline",
      defaultName: "Track",
      editor: TrackLayerPluginEditor,
    },
  ],
  [
    "photo-layer",
    {
      icon: "mdi-image-marker",
      defaultName: "Photo",
      editor: PhotoLayerPluginEditor,
    },
  ],
  [
    "tile-grid-layer",
    {
      icon: "mdi-grid",
      defaultName: "Tile Grid",
      editor: SchemaLayerEditor,
    },
  ],
]);

const fallbackPresentation: LayerTypePresentation = {
  icon: "mdi-layers-outline",
  defaultName: "Layer",
  editor: SchemaLayerEditor,
};

export function layerTypePresentation(pluginId: string): LayerTypePresentation {
  return presentations.get(pluginId) ?? fallbackPresentation;
}
