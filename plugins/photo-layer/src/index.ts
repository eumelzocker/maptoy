import {
  assertPointGeometry,
  LAYER_PLUGIN_SDK_VERSION,
  type InteractiveLayerInput,
  type LayerPluginDefinition,
  type PointFeature,
} from "@maptoy/layer-plugin-sdk";

export const PHOTO_LAYER_PLUGIN_ID = "photo-layer";

export interface PhotoLayerConfiguration {
  pointColor: string;
  pointRadius: number;
  showPreviews: boolean;
}

const defaultConfiguration: PhotoLayerConfiguration = {
  pointColor: "#2e77d0",
  pointRadius: 7,
  showPreviews: true,
};

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Photo layer values must be objects.");
  }
  return value as Record<string, unknown>;
}

function validateConfiguration(value: unknown): PhotoLayerConfiguration {
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
    throw new Error("Photo layer configuration is invalid.");
  }
  return { pointColor, pointRadius, showPreviews };
}

interface PhotoPointProperties {
  fileName: string;
  previewUrl?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

interface PhotoPopupFieldVisibility {
  name: boolean;
  coordinates: boolean;
  capturedAt: boolean;
  manufacturer: boolean;
  cameraModel: boolean;
  iso: boolean;
  fStop: boolean;
  shutterSpeed: boolean;
  caption: boolean;
}

const popupFieldVisibility: PhotoPopupFieldVisibility = {
  name: true,
  coordinates: true,
  capturedAt: true,
  manufacturer: false,
  cameraModel: false,
  iso: false,
  fStop: false,
  shutterSpeed: false,
  caption: false,
};

function coordinateToDms(
  value: number,
  positiveLetter: string,
  negativeLetter: string,
): string {
  const totalSeconds = Math.round(Math.abs(value) * 36_000) / 10;
  const degrees = Math.floor(totalSeconds / 3_600);
  const remainingSeconds = totalSeconds - degrees * 3_600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds - minutes * 60;
  return `${degrees}°${minutes}'${seconds.toFixed(1)}"${value >= 0 ? positiveLetter : negativeLetter}`;
}

function photoCoordinateLine(coordinate: {
  longitude: number;
  latitude: number;
}): string {
  return `${coordinateToDms(coordinate.latitude, "N", "S")}, ${coordinateToDms(coordinate.longitude, "E", "W")}`;
}

function metadataText(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function metadataNumber(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function shutterSpeedLabel(seconds: number): string {
  return seconds < 1
    ? `1/${Math.round(1 / seconds)} s`
    : `${seconds.toLocaleString("en-US", { maximumFractionDigits: 3 })} s`;
}

function photoPopupLines(
  fileName: string,
  coordinate: { longitude: number; latitude: number },
  metadata: Readonly<Record<string, unknown>> | undefined,
): string[] {
  const lines: string[] = [];
  const capturedAt = metadataText(metadata, "capturedAt");
  const manufacturer = metadataText(metadata, "manufacturer");
  const cameraModel = metadataText(metadata, "cameraModel");
  const iso = metadataNumber(metadata, "iso");
  const fStop = metadataNumber(metadata, "fStop");
  const shutterSpeed = metadataNumber(metadata, "shutterSpeed");
  const iptc = metadata?.iptc;
  const caption =
    typeof iptc === "object" && iptc !== null && "caption" in iptc
      ? metadataText(iptc as Readonly<Record<string, unknown>>, "caption")
      : undefined;
  if (popupFieldVisibility.name) lines.push(fileName);
  if (popupFieldVisibility.coordinates) {
    lines.push(photoCoordinateLine(coordinate));
  }
  if (popupFieldVisibility.capturedAt && capturedAt !== undefined) {
    lines.push(`Captured: ${capturedAt}`);
  }
  if (popupFieldVisibility.manufacturer && manufacturer !== undefined) {
    lines.push(`Manufacturer: ${manufacturer}`);
  }
  if (popupFieldVisibility.cameraModel && cameraModel !== undefined) {
    lines.push(`Camera model: ${cameraModel}`);
  }
  if (popupFieldVisibility.iso && iso !== undefined) lines.push(`ISO: ${iso}`);
  if (popupFieldVisibility.fStop && fStop !== undefined) {
    lines.push(`F-stop: f/${fStop}`);
  }
  if (popupFieldVisibility.shutterSpeed && shutterSpeed !== undefined) {
    lines.push(`Shutter speed: ${shutterSpeedLabel(shutterSpeed)}`);
  }
  if (popupFieldVisibility.caption && caption !== undefined) {
    lines.push(`Caption: ${caption}`);
  }
  return lines;
}

function photoPointFeatures(
  input: InteractiveLayerInput,
): Array<PointFeature<PhotoPointProperties>> {
  return input.assets
    .filter(
      (asset) =>
        asset.status === "ready" &&
        asset.longitude !== null &&
        asset.latitude !== null,
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
          ...(asset.metadata === undefined ? {} : { metadata: asset.metadata }),
        },
      };
    });
}

function descriptor(input: InteractiveLayerInput) {
  const configuration = validateConfiguration(input.configuration);
  const points = photoPointFeatures(input);
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
            popupLines: photoPopupLines(
              feature.properties.fileName,
              feature.geometry.coordinate,
              feature.properties.metadata,
            ),
            symbolizer: {
              radius: configuration.pointRadius,
              fillColor: configuration.pointColor,
              strokeColor: "#ffffff",
              strokeWidth: 2,
              fillOpacity: 0.9,
            },
          })),
        },
      ],
    },
  };
}

export const photoLayerPlugin = {
  manifest: {
    id: PHOTO_LAYER_PLUGIN_ID,
    version: "0.2.0",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Photo layer",
    category: { id: "photos", displayName: "Photos" },
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
    requiredRendererLayerTypes: ["point-collection", "composite"],
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
        if (asset.longitude !== null && asset.latitude !== null) {
          context.surface.drawPoint(
            {
              longitude: asset.longitude,
              latitude: asset.latitude,
            },
            {
              fillColor: configuration.pointColor,
              radius: configuration.pointRadius,
              opacity: context.opacity,
            },
          );
        }
      }
    },
  },
} satisfies LayerPluginDefinition;
