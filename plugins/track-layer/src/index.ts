import {
  assertLineGeometry,
  LAYER_PLUGIN_SDK_VERSION,
  type LayerPluginDefinition,
  type LineFeature,
} from "@maptoy/layer-plugin-sdk";

export const TRACK_LAYER_PLUGIN_ID = "track-layer";

export interface TrackLayerConfiguration {
  lineColor: string;
  lineWidth: number;
  lineOpacity: number;
}

export interface TrackProperties {
  name?: string;
  description?: string;
}

export interface TrackVertexProperties {
  timestamp?: string;
}

export interface TrackLayerData {
  features: Array<LineFeature<TrackProperties, TrackVertexProperties>>;
}

const defaultConfiguration: TrackLayerConfiguration = {
  lineColor: "#e24a33",
  lineWidth: 3,
  lineOpacity: 0.9,
};

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function validateConfiguration(value: unknown): TrackLayerConfiguration {
  const input = record(value, "Track layer configuration must be an object.");
  const lineColor = input.lineColor ?? defaultConfiguration.lineColor;
  const lineWidth = input.lineWidth ?? defaultConfiguration.lineWidth;
  const lineOpacity = input.lineOpacity ?? defaultConfiguration.lineOpacity;
  if (
    typeof lineColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(lineColor) ||
    typeof lineWidth !== "number" ||
    !Number.isFinite(lineWidth) ||
    lineWidth < 1 ||
    lineWidth > 20 ||
    typeof lineOpacity !== "number" ||
    !Number.isFinite(lineOpacity) ||
    lineOpacity < 0 ||
    lineOpacity > 1
  ) {
    throw new Error("Track layer style is invalid.");
  }
  return { lineColor, lineWidth, lineOpacity };
}

function validateData(value: unknown): TrackLayerData {
  const input = record(value, "Track layer data must be an object.");
  if (!Array.isArray(input.features)) {
    throw new Error("Track layer data requires a features array.");
  }
  for (const candidate of input.features) {
    const feature = record(candidate, "Track features must be objects.");
    if (
      typeof feature.id !== "string" ||
      feature.id.length === 0 ||
      typeof feature.geometry !== "object" ||
      feature.geometry === null
    ) {
      throw new Error("Track feature identity or geometry is invalid.");
    }
    assertLineGeometry(feature.geometry as LineFeature["geometry"]);
  }
  return input as unknown as TrackLayerData;
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function tagText(xml: string, tag: string): string | undefined {
  const match = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`,
    "i",
  ).exec(xml);
  return match?.[1] === undefined ? undefined : decodeXmlText(match[1].trim());
}

function parseGpx(bytes: Uint8Array): TrackLayerData {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error(
      "GPX documents with DTD or entity declarations are rejected.",
    );
  }
  const features: TrackLayerData["features"] = [];
  const segmentPattern =
    /<(?:[a-zA-Z0-9_-]+:)?trkseg(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?trkseg>/gi;
  let segmentMatch = segmentPattern.exec(xml);
  let segmentIndex = 0;
  while (segmentMatch !== null) {
    const segment = segmentMatch[1] ?? "";
    const vertices: Array<{
      coordinate: { longitude: number; latitude: number; elevation?: number };
      properties?: TrackVertexProperties;
    }> = [];
    const pointPattern =
      /<(?:[a-zA-Z0-9_-]+:)?trkpt\s+([^>]*?)>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?trkpt>/gi;
    let pointMatch = pointPattern.exec(segment);
    while (pointMatch !== null) {
      const attributes = pointMatch[1] ?? "";
      const latitudeMatch = /\blat\s*=\s*["']([^"']+)["']/i.exec(attributes);
      const longitudeMatch = /\blon\s*=\s*["']([^"']+)["']/i.exec(attributes);
      const latitude = Number(latitudeMatch?.[1]);
      const longitude = Number(longitudeMatch?.[1]);
      const body = pointMatch[2] ?? "";
      const elevationText = tagText(body, "ele");
      const timestamp = tagText(body, "time");
      const elevation =
        elevationText === undefined ? undefined : Number(elevationText);
      vertices.push({
        coordinate: {
          longitude,
          latitude,
          ...(typeof elevation === "number" && Number.isFinite(elevation)
            ? { elevation }
            : {}),
        },
        ...(timestamp === undefined ? {} : { properties: { timestamp } }),
      });
      pointMatch = pointPattern.exec(segment);
    }
    if (vertices.length >= 2) {
      const name = tagText(xml, "name");
      const description = tagText(xml, "desc");
      features.push({
        id: `track-${segmentIndex + 1}`,
        geometry: { type: "LineString", vertices },
        properties: {
          ...(name === undefined ? {} : { name }),
          ...(description === undefined ? {} : { description }),
        },
      });
      segmentIndex += 1;
    }
    segmentMatch = segmentPattern.exec(xml);
  }
  if (features.length === 0) {
    throw new Error("The GPX document contains no usable track segment.");
  }
  return { features };
}

function coordinates(
  value: unknown,
): Array<{ longitude: number; latitude: number; elevation?: number }> {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("GeoJSON lines require at least two coordinates.");
  }
  return value.map((candidate) => {
    if (
      !Array.isArray(candidate) ||
      candidate.length < 2 ||
      typeof candidate[0] !== "number" ||
      typeof candidate[1] !== "number"
    ) {
      throw new Error("GeoJSON contains an invalid coordinate.");
    }
    return {
      longitude: candidate[0],
      latitude: candidate[1],
      ...(typeof candidate[2] === "number" ? { elevation: candidate[2] } : {}),
    };
  });
}

function parseGeoJson(bytes: Uint8Array): TrackLayerData {
  const parsed = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
  const root = record(parsed, "GeoJSON must be an object.");
  const sourceFeatures =
    root.type === "FeatureCollection" && Array.isArray(root.features)
      ? root.features
      : root.type === "Feature"
        ? [root]
        : [{ type: "Feature", properties: {}, geometry: root }];
  const features: TrackLayerData["features"] = [];
  for (const [featureIndex, candidate] of sourceFeatures.entries()) {
    const feature = record(candidate, "GeoJSON features must be objects.");
    const geometry = record(
      feature.geometry,
      "GeoJSON feature geometry must be an object.",
    );
    const properties =
      typeof feature.properties === "object" &&
      feature.properties !== null &&
      !Array.isArray(feature.properties)
        ? (feature.properties as Record<string, unknown>)
        : {};
    const lines =
      geometry.type === "LineString"
        ? [geometry.coordinates]
        : geometry.type === "MultiLineString" &&
            Array.isArray(geometry.coordinates)
          ? geometry.coordinates
          : null;
    if (lines === null) {
      throw new Error(
        "Only GeoJSON LineString and MultiLineString are supported.",
      );
    }
    for (const [lineIndex, line] of lines.entries()) {
      features.push({
        id:
          typeof feature.id === "string"
            ? `${feature.id}-${lineIndex + 1}`
            : `feature-${featureIndex + 1}-${lineIndex + 1}`,
        geometry: {
          type: "LineString",
          vertices: coordinates(line).map((coordinate) => ({ coordinate })),
        },
        properties: {
          ...(typeof properties.name === "string"
            ? { name: properties.name }
            : {}),
          ...(typeof properties.description === "string"
            ? { description: properties.description }
            : {}),
        },
      });
    }
  }
  return validateData({ features });
}

function renderDescriptor(
  input: Parameters<NonNullable<LayerPluginDefinition["frontend"]>["mount"]>[1],
) {
  const configuration = validateConfiguration(input.configuration);
  const data = validateData(input.data);
  return {
    type: "line-collection" as const,
    data: {
      kind: "line-collection" as const,
      features: data.features.map((feature) => ({
        id: feature.id,
        coordinates: feature.geometry.vertices.map(
          ({ coordinate }) => coordinate,
        ),
        title: feature.properties.name,
        symbolizer: {
          color: configuration.lineColor,
          width: configuration.lineWidth,
          opacity: configuration.lineOpacity,
        },
      })),
    },
  };
}

export const trackLayerPlugin = {
  manifest: {
    id: TRACK_LAYER_PLUGIN_ID,
    version: "0.2.0",
    sdkVersion: LAYER_PLUGIN_SDK_VERSION,
    displayName: "Track layer",
    category: { id: "tracks", displayName: "Tracks" },
    schemaVersion: 1,
    configurationSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        lineColor: { type: "string" },
        lineWidth: { type: "number", minimum: 1, maximum: 20 },
        lineOpacity: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    dataSchema: {
      type: "object",
      required: ["features"],
      properties: { features: { type: "array" } },
    },
    capabilities: {
      interactive: true,
      assetImport: true,
      serverPreview: false,
      serverRender: true,
    },
  },
  shared: {
    validateConfiguration,
    validateData,
    migrations: [],
  },
  frontend: {
    mount: (context, input) => {
      context.publishLayer(renderDescriptor(input));
      return {
        update: (nextInput) => {
          context.publishLayer(renderDescriptor(nextInput));
        },
        destroy: context.clearLayer,
      };
    },
  },
  assetImport: {
    importAsset: (asset) => {
      const lowerName = asset.fileName.toLowerCase();
      const data =
        lowerName.endsWith(".gpx") || asset.mimeType === "application/gpx+xml"
          ? parseGpx(asset.bytes)
          : parseGeoJson(asset.bytes);
      return {
        configuration: defaultConfiguration,
        data,
        managedAssetIds: [asset.assetId],
      };
    },
  },
  server: {
    render: (context) => {
      const configuration = validateConfiguration(context.configuration);
      const data = validateData(context.data);
      for (const feature of data.features) {
        context.surface.drawPolyline(
          feature.geometry.vertices.map(({ coordinate }) => coordinate),
          {
            color: configuration.lineColor,
            width: configuration.lineWidth,
            opacity: configuration.lineOpacity,
          },
        );
      }
    },
  },
} satisfies LayerPluginDefinition;
