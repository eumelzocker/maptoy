import { readFile } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import sharp, { type OverlayOptions } from "sharp";
import type { ServerLayerPlugin } from "./types.js";

interface TrackConfiguration {
  assetPath: string;
  color: string;
  width: number;
}

interface TrackDocument {
  features?: Array<{
    geometry?: {
      type?: string;
      coordinates?: Array<[number, number]>;
    };
  }>;
}

interface GpsImageConfiguration {
  mode: "gps";
  assetPath: string;
  width: number;
}

interface BoundsImageConfiguration {
  mode: "bounds";
  assetPath: string;
  north: number;
  east: number;
  south: number;
  west: number;
  opacity: number;
}

type ImageConfiguration = GpsImageConfiguration | BoundsImageConfiguration;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${key} must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${key} must be a finite number.`);
  }
  return value;
}

function svgPolyline(
  width: number,
  height: number,
  points: Array<{ x: number; y: number }>,
  color: string,
  lineWidth: number,
): Buffer {
  const pointList = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const controls = points
    .map(
      ({ x, y }) =>
        `<circle cx="${x}" cy="${y}" r="6" fill="#ffffff" stroke="${color}" stroke-width="3"/>`,
    )
    .join("");
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <polyline points="${pointList}" fill="none" stroke="#ffffff" stroke-width="${lineWidth + 4}" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${pointList}" fill="none" stroke="${color}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      ${controls}
    </svg>
  `);
}

export const trackPlugin: ServerLayerPlugin<TrackConfiguration> = {
  id: "track-layer",
  validate(input): TrackConfiguration {
    if (!isRecord(input)) {
      throw new TypeError("Track configuration must be an object.");
    }
    const width = requireFiniteNumber(input, "width");
    if (width <= 0 || width > 32) {
      throw new RangeError(
        "Track width must be greater than 0 and at most 32.",
      );
    }
    return {
      assetPath: requireString(input, "assetPath"),
      color: requireString(input, "color"),
      width,
    };
  },
  async render(context, configuration): Promise<OverlayOptions[]> {
    const document = JSON.parse(
      await readFile(configuration.assetPath, "utf8"),
    ) as TrackDocument;
    const line = document.features?.find(
      (feature) => feature.geometry?.type === "LineString",
    )?.geometry?.coordinates;
    if (line === undefined || line.length < 2) {
      throw new TypeError("Track fixture must contain a LineString.");
    }
    const points = line.map(([lon, lat]) =>
      context.lonLatToPixel({ lon, lat }),
    );
    return [
      {
        input: svgPolyline(
          context.width,
          context.height,
          points,
          configuration.color,
          configuration.width,
        ),
        left: 0,
        top: 0,
      },
    ];
  },
};

export const imagePlugin: ServerLayerPlugin<ImageConfiguration> = {
  id: "image-layer",
  validate(input): ImageConfiguration {
    if (!isRecord(input)) {
      throw new TypeError("Image configuration must be an object.");
    }
    const mode = requireString(input, "mode");
    if (mode === "gps") {
      const width = requireFiniteNumber(input, "width");
      if (width < 16 || width > 512) {
        throw new RangeError("GPS image width must be between 16 and 512.");
      }
      return {
        mode,
        assetPath: requireString(input, "assetPath"),
        width,
      };
    }
    if (mode === "bounds") {
      const configuration = {
        mode,
        assetPath: requireString(input, "assetPath"),
        north: requireFiniteNumber(input, "north"),
        east: requireFiniteNumber(input, "east"),
        south: requireFiniteNumber(input, "south"),
        west: requireFiniteNumber(input, "west"),
        opacity: requireFiniteNumber(input, "opacity"),
      } satisfies BoundsImageConfiguration;
      if (
        configuration.north <= configuration.south ||
        configuration.east <= configuration.west
      ) {
        throw new RangeError("Image bounds are empty or inverted.");
      }
      if (configuration.opacity < 0 || configuration.opacity > 1) {
        throw new RangeError("Image opacity must be between 0 and 1.");
      }
      return configuration;
    }
    throw new TypeError(`Unsupported image mode: ${mode}`);
  },
  async render(context, configuration): Promise<OverlayOptions[]> {
    if (configuration.mode === "gps") {
      const metadata = (await exifr.parse(configuration.assetPath, {
        gps: true,
        pick: ["GPSLatitude", "GPSLongitude", "Orientation"],
      })) as
        | {
            latitude?: number;
            longitude?: number;
            Orientation?: number | string;
          }
        | undefined;
      if (
        metadata?.latitude === undefined ||
        metadata.longitude === undefined
      ) {
        throw new TypeError("GPS image fixture has no readable coordinates.");
      }
      const pixel = context.lonLatToPixel({
        lon: metadata.longitude,
        lat: metadata.latitude,
      });
      const image = await sharp(configuration.assetPath)
        .autoOrient()
        .resize({ width: configuration.width })
        .png()
        .toBuffer({ resolveWithObject: true });
      return [
        {
          input: image.data,
          left: Math.round(pixel.x - image.info.width / 2),
          top: Math.round(pixel.y - image.info.height / 2),
        },
      ];
    }

    const northwest = context.lonLatToPixel({
      lon: configuration.west,
      lat: configuration.north,
    });
    const southeast = context.lonLatToPixel({
      lon: configuration.east,
      lat: configuration.south,
    });
    const width = Math.max(1, Math.round(southeast.x - northwest.x));
    const height = Math.max(1, Math.round(southeast.y - northwest.y));
    const image = await sharp(configuration.assetPath)
      .resize(width, height, { fit: "fill" })
      .ensureAlpha(configuration.opacity)
      .png()
      .toBuffer();
    return [
      {
        input: image,
        left: Math.round(northwest.x),
        top: Math.round(northwest.y),
      },
    ];
  },
};

export const pluginRegistry = new Map([
  [trackPlugin.id, trackPlugin as ServerLayerPlugin<unknown>],
  [imagePlugin.id, imagePlugin as ServerLayerPlugin<unknown>],
]);

export function assertManagedFixturePath(
  assetRoot: string,
  assetPath: string,
): void {
  const relative = path.relative(assetRoot, assetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Layer asset is outside the managed fixture root: ${assetPath}`,
    );
  }
}
