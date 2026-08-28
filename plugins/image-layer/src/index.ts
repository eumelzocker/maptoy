import {
  assertPointGeometry,
  LAYER_PLUGIN_SDK_VERSION,
  type InteractiveLayerInput,
  type LayerPluginDefinition,
  type PointFeature,
} from "@maptoy/layer-plugin-sdk";

export const IMAGE_LAYER_PLUGIN_ID = "image-layer";

export interface ImageLayerConfiguration {
  pointColor: string;
  pointRadius: number;
  showPreviews: boolean;
}

const defaultConfiguration: ImageLayerConfiguration = {
  pointColor: "#2e77d0",
  pointRadius: 7,
  showPreviews: true,
};

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Image layer values must be objects.");
  }
  return value as Record<string, unknown>;
}

function validateConfiguration(value: unknown): ImageLayerConfiguration {
  const input = requireRecord(value);
  const pointColor = input.pointColor ?? defaultConfiguration.pointColor;
  const pointRadius = input.pointRadius ?? defaultConfiguration.pointRadius;
  const showPreviews = input.showPreviews ?? defaultConfiguration.showPreviews;
  if (
    typeof pointColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(pointColor) ||
    typeof pointRadius !== "number" ||
    !Number.isFinite(pointRadius) ||
    pointRadius < 2 ||
    pointRadius > 30 ||
    typeof showPreviews !== "boolean"
  ) {
    throw new Error("Image layer configuration is invalid.");
  }
  return { pointColor, pointRadius, showPreviews };
}

interface ImagePointProperties {
  fileName: string;
  previewUrl?: string;
}

function imagePointFeatures(
  input: InteractiveLayerInput,
): Array<PointFeature<ImagePointProperties>> {
  return input.assets
    .filter(
      (asset) =>
        asset.status === "ready" &&
        asset.longitude !== null &&
        asset.latitude !== null &&
        asset.bounds === undefined,
    )
    .map((asset) => {
      const geometry = {
        type: "Point" as const,
        coordinate: {
          longitude: asset.longitude as number,
          latitude: asset.latitude as number,
        },
      };
      assertPointGeometry(geometry);
      return {
        id: asset.id,
        geometry,
        properties: {
          fileName: asset.fileName,
          ...(asset.previewUrl === undefined
            ? {}
            : { previewUrl: asset.previewUrl }),
        },
      };
    });
}

function descriptor(input: InteractiveLayerInput) {
  const configuration = validateConfiguration(input.configuration);
  const ready = input.assets.filter((asset) => asset.status === "ready");
  const points = imagePointFeatures(input);
  return {
    type: "composite" as const,
    data: {
      kind: "composite" as const,
      layers: [
        {
          kind: "point-collection" as const,
          features: points.map((feature) => ({
            id: feature.id,
            coordinate: feature.geometry.coordinate,
            title: feature.properties.fileName,
            ...(configuration.showPreviews &&
            feature.properties.previewUrl !== undefined
              ? { previewUrl: feature.properties.previewUrl }
              : {}),
            symbolizer: {
              radius: configuration.pointRadius,
              fillColor: configuration.pointColor,
              strokeColor: "#ffffff",
              strokeWidth: 2,
              fillOpacity: 0.9,
            },
          })),
        },
        {
          kind: "raster-overlay" as const,
          features: ready
            .filter(
              (asset) =>
                asset.bounds !== undefined && asset.previewUrl !== undefined,
            )
            .map((asset) => ({
              id: asset.id,
              imageUrl: asset.previewUrl as string,
              bounds: asset.bounds as NonNullable<typeof asset.bounds>,
              title: asset.fileName,
            })),
        },
      ],
    },
  };
}

export const imageLayerPlugin = {
  manifest: {
    id: IMAGE_LAYER_PLUGIN_ID,
    version: "0.2.0",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Image layer",
    category: { id: "images", displayName: "Images" },
    schemaVersion: 1,
    configurationSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pointColor: { type: "string" },
        pointRadius: { type: "number", minimum: 2, maximum: 30 },
        showPreviews: { type: "boolean" },
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
      serverRender: true,
    },
  },
  shared: {
    validateConfiguration,
    validateData: requireRecord,
    migrations: [],
  },
  frontend: {
    mount: (context, input) => {
      context.publishLayer(descriptor(input));
      return {
        update: (nextInput) => {
          context.publishLayer(descriptor(nextInput));
        },
        destroy: context.clearLayer,
      };
    },
  },
  server: {
    render: (context) => {
      const configuration = validateConfiguration(context.configuration);
      for (const asset of context.assets) {
        if (asset.bounds !== undefined) {
          context.surface.drawManagedImage(asset.assetId, asset.bounds, 1);
        } else if (asset.longitude !== null && asset.latitude !== null) {
          context.surface.drawPoint(
            {
              longitude: asset.longitude,
              latitude: asset.latitude,
            },
            {
              fillColor: configuration.pointColor,
              radius: configuration.pointRadius,
            },
          );
        }
      }
    },
  },
} satisfies LayerPluginDefinition;
