import {
  LAYER_PLUGIN_SDK_VERSION,
  type InteractiveLayerInput,
  type LayerPluginDefinition,
} from "@maptoy/layer-plugin-sdk";

export const MAP_SET_LAYER_PLUGIN_ID = "map-set-layer";

export interface MapSetLayerConfiguration {
  mapSetId: string;
  allowProviderRequests: boolean;
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

export function validateMapSetLayerConfiguration(
  value: unknown,
): MapSetLayerConfiguration {
  const input = record(value, "Map Set layer configuration must be an object.");
  const mapSetId = input.mapSetId;
  const allowProviderRequests = input.allowProviderRequests ?? false;
  if (
    typeof mapSetId !== "string" ||
    mapSetId.length === 0 ||
    typeof allowProviderRequests !== "boolean" ||
    Object.keys(input).some(
      (key) => key !== "mapSetId" && key !== "allowProviderRequests",
    )
  ) {
    throw new Error("Map Set layer configuration is invalid.");
  }
  return { mapSetId, allowProviderRequests };
}

function validateData(value: unknown): Record<string, never> {
  const data = record(value, "Map Set layer data must be an object.");
  if (Object.keys(data).length > 0) {
    throw new Error("Map Set layer data must be empty.");
  }
  return {};
}

function descriptor(input: InteractiveLayerInput) {
  const configuration = validateMapSetLayerConfiguration(input.configuration);
  validateData(input.data);
  return {
    type: "xyz-tile-layer" as const,
    data: {
      kind: "xyz-tile-layer" as const,
      mapSetId: configuration.mapSetId,
      allowProviderRequests: configuration.allowProviderRequests,
    },
  };
}

export const mapSetLayerPlugin = {
  manifest: {
    id: MAP_SET_LAYER_PLUGIN_ID,
    version: "0.4.2",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Map Set layer",
    category: { id: "map-sets", displayName: "Map Sets" },
    schemaVersion: 1,
    configurationSchema: {
      type: "object",
      additionalProperties: false,
      required: ["mapSetId", "allowProviderRequests"],
      properties: {
        mapSetId: { type: "string", title: "Map Set" },
        allowProviderRequests: {
          type: "boolean",
          title: "Load missing Tiles from provider",
          default: false,
        },
      },
    },
    dataSchema: { type: "object", additionalProperties: false },
    capabilities: {
      interactive: true,
      assetImport: false,
      serverPreview: false,
      serverRender: false,
    },
    requiredRendererLayerTypes: ["xyz-tile-layer"],
  },
  shared: {
    validateConfiguration: validateMapSetLayerConfiguration,
    validateData,
    migrations: [],
  },
  frontend: {
    mount: (context, input) => {
      context.publishLayer(descriptor(input));
      return {
        update: (nextInput) => context.publishLayer(descriptor(nextInput)),
        destroy: context.clearLayer,
      };
    },
  },
} satisfies LayerPluginDefinition;
