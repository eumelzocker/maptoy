import {
  LAYER_PLUGIN_SDK_VERSION,
  type LayerPluginDefinition,
} from "@maptoy/layer-plugin-sdk";

export const IMAGE_LAYER_PLUGIN_ID = "image-layer";

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Image layer values must be objects.");
  }
  return value as Record<string, unknown>;
}

export const imageLayerPlugin = {
  manifest: {
    id: IMAGE_LAYER_PLUGIN_ID,
    version: "0.0.0",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Image layer",
    schemaVersion: 1,
    configurationSchema: {
      type: "object",
      additionalProperties: true,
    },
    dataSchema: {
      type: "object",
      additionalProperties: true,
    },
    capabilities: {
      interactive: false,
      assetImport: false,
      serverPreview: false,
      serverRender: false,
    },
  },
  shared: {
    validateConfiguration: requireRecord,
    validateData: requireRecord,
    migrations: [],
  },
} satisfies LayerPluginDefinition;
