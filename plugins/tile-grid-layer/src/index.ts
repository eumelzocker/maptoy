import {
  LAYER_PLUGIN_SDK_VERSION,
  type InteractiveLayerInput,
  type LayerPluginDefinition,
  type LayerPluginMigrationState,
} from "@maptoy/layer-plugin-sdk";

export const TILE_GRID_LAYER_PLUGIN_ID = "tile-grid-layer";

export interface TileGridLayerConfiguration {
  showGrid: boolean;
  showLabels: boolean;
  showScale: boolean;
  lineColor: string;
  textColor: string;
  backgroundColor: string;
  scaleWidthPercent: number;
}

export const defaultTileGridLayerConfiguration: TileGridLayerConfiguration = {
  showGrid: true,
  showLabels: true,
  showScale: true,
  lineColor: "#20202080",
  textColor: "#202020ff",
  backgroundColor: "#ffffffd0",
  scaleWidthPercent: 50,
};

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function color(value: unknown): value is string {
  return (
    typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)
  );
}

function validateConfiguration(value: unknown): TileGridLayerConfiguration {
  const input = record(
    value,
    "Tile Grid layer configuration must be an object.",
  );
  const showGrid = input.showGrid ?? defaultTileGridLayerConfiguration.showGrid;
  const showLabels =
    input.showLabels ?? defaultTileGridLayerConfiguration.showLabels;
  const showScale =
    input.showScale ?? defaultTileGridLayerConfiguration.showScale;
  const lineColor =
    input.lineColor ?? defaultTileGridLayerConfiguration.lineColor;
  const textColor =
    input.textColor ?? defaultTileGridLayerConfiguration.textColor;
  const backgroundColor =
    input.backgroundColor ?? defaultTileGridLayerConfiguration.backgroundColor;
  const scaleWidthPercent =
    input.scaleWidthPercent ??
    defaultTileGridLayerConfiguration.scaleWidthPercent;
  if (
    typeof showGrid !== "boolean" ||
    typeof showLabels !== "boolean" ||
    typeof showScale !== "boolean" ||
    !color(lineColor) ||
    !color(textColor) ||
    !color(backgroundColor) ||
    typeof scaleWidthPercent !== "number" ||
    !Number.isFinite(scaleWidthPercent) ||
    scaleWidthPercent < 25 ||
    scaleWidthPercent > 100
  ) {
    throw new Error("Tile Grid layer configuration is invalid.");
  }
  return {
    showGrid,
    showLabels,
    showScale,
    lineColor,
    textColor,
    backgroundColor,
    scaleWidthPercent,
  };
}

function migrateVersionOneLayer(
  state: LayerPluginMigrationState,
): LayerPluginMigrationState {
  const configuration = record(
    state.configuration,
    "Tile Grid layer configuration must be an object.",
  );
  const legacyWidth = configuration.scaleMaximumWidth;
  const remainingConfiguration = Object.fromEntries(
    Object.entries(configuration).filter(
      ([key]) => key !== "scaleMaximumWidth",
    ),
  );
  return {
    ...state,
    configuration: {
      ...remainingConfiguration,
      scaleWidthPercent:
        typeof legacyWidth === "number" && Number.isFinite(legacyWidth)
          ? Math.min(100, Math.max(25, Math.round((legacyWidth / 256) * 100)))
          : defaultTileGridLayerConfiguration.scaleWidthPercent,
    },
  };
}

function validateData(value: unknown): Record<string, never> {
  const data = record(value, "Tile Grid layer data must be an object.");
  if (Object.keys(data).length > 0) {
    throw new Error("Tile Grid layer data must be empty.");
  }
  return {};
}

function descriptor(input: InteractiveLayerInput) {
  const configuration = validateConfiguration(input.configuration);
  validateData(input.data);
  return {
    type: "composite" as const,
    data: {
      kind: "composite" as const,
      layers: [
        ...(configuration.showGrid ||
        configuration.showLabels ||
        configuration.showScale
          ? [
              {
                kind: "xyz-tile-grid" as const,
                lineColor: configuration.lineColor,
                textColor: configuration.textColor,
                backgroundColor: configuration.backgroundColor,
                showGrid: configuration.showGrid,
                showLabels: configuration.showLabels,
                showScale: configuration.showScale,
                scaleWidthPercent: configuration.scaleWidthPercent,
              },
            ]
          : []),
      ],
    },
  };
}

export const tileGridLayerPlugin = {
  manifest: {
    id: TILE_GRID_LAYER_PLUGIN_ID,
    version: "0.2.3",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Tile Grid layer",
    category: { id: "decorations", displayName: "Decorations" },
    schemaVersion: 2,
    configurationSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        showGrid: {
          type: "boolean",
          title: "Show tile grid",
          default: defaultTileGridLayerConfiguration.showGrid,
        },
        showLabels: {
          type: "boolean",
          title: "Show z/x/y labels",
          default: defaultTileGridLayerConfiguration.showLabels,
        },
        showScale: {
          type: "boolean",
          title: "Show metric scale bar",
          default: defaultTileGridLayerConfiguration.showScale,
        },
        lineColor: {
          type: "string",
          title: "Line color",
          format: "color-alpha",
          default: defaultTileGridLayerConfiguration.lineColor,
        },
        textColor: {
          type: "string",
          title: "Text color",
          format: "color-alpha",
          default: defaultTileGridLayerConfiguration.textColor,
        },
        backgroundColor: {
          type: "string",
          title: "Label background",
          format: "color-alpha",
          default: defaultTileGridLayerConfiguration.backgroundColor,
        },
        scaleWidthPercent: {
          type: "number",
          title: "Scale width (% of Tile)",
          minimum: 25,
          maximum: 100,
          step: 1,
          uiControl: "range",
          default: defaultTileGridLayerConfiguration.scaleWidthPercent,
        },
      },
    },
    dataSchema: {
      type: "object",
      additionalProperties: false,
    },
    capabilities: {
      interactive: true,
      assetImport: false,
      serverPreview: false,
      serverRender: false,
    },
    requiredRendererLayerTypes: ["xyz-tile-grid", "composite"],
  },
  shared: {
    validateConfiguration,
    validateData,
    migrations: [
      {
        fromSchemaVersion: 1,
        toSchemaVersion: 2,
        migrateLayer: migrateVersionOneLayer,
      },
    ],
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
