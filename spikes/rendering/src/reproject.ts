import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import proj4 from "proj4";
import sharp from "sharp";
import {
  MAX_TILE_X,
  MAX_TILE_Y,
  MIN_TILE_X,
  MIN_TILE_Y,
  MOSAIC_HEIGHT,
  MOSAIC_WIDTH,
  OUTPUT_ROOT,
} from "./config.js";
import { tileCornerToLonLat } from "./geo.js";

const WGS84 = "EPSG:4326";
const WEB_MERCATOR = "EPSG:3857";
const TARGET_PROJECTIONS = [WGS84, "EPSG:25833"] as const;
const PROJECTION_CASES: ReadonlyArray<{
  projection: TargetProjection;
  width: number;
  height: number;
}> = [
  { projection: WGS84, width: MOSAIC_WIDTH, height: MOSAIC_HEIGHT },
  { projection: "EPSG:25833", width: MOSAIC_WIDTH, height: MOSAIC_HEIGHT },
  { projection: "EPSG:25833", width: 4096, height: 4096 },
  { projection: "EPSG:25833", width: 8192, height: 8192 },
];

proj4.defs(
  "EPSG:25833",
  "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs +type=crs",
);

type TargetProjection = (typeof TARGET_PROJECTIONS)[number];

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface DifferenceMeasurement {
  meanAbsoluteChannelDifference: number;
  maximumChannelDifference: number;
  pixelsAboveEight: number;
  pixelCount: number;
}

export interface ProjectionMeasurement {
  targetProjection: TargetProjection;
  width: number;
  height: number;
  targetExtent: Extent;
  nodeOutput: string;
  gdalOutput: string;
  nodeMilliseconds: number;
  gdalMilliseconds: number;
  nodeMaxRssKilobytes: number;
  gdalMaxRssKilobytes: number;
  difference: DifferenceMeasurement;
}

export interface ReprojectionReport {
  sourceProjection: typeof WEB_MERCATOR;
  sourceExtent: Extent;
  measurements: ProjectionMeasurement[];
}

function transformedPoint(
  source: string,
  target: string,
  x: number,
  y: number,
): [number, number] {
  const result = proj4(source, target, [x, y]);
  const resultX = result[0];
  const resultY = result[1];
  if (
    resultX === undefined ||
    resultY === undefined ||
    !Number.isFinite(resultX) ||
    !Number.isFinite(resultY)
  ) {
    throw new Error(
      `Projection ${source} -> ${target} produced a non-finite coordinate.`,
    );
  }
  return [resultX, resultY];
}

export function sourceExtent3857(): Extent {
  const northwest = tileCornerToLonLat(MIN_TILE_X, MIN_TILE_Y);
  const southeast = tileCornerToLonLat(MAX_TILE_X + 1, MAX_TILE_Y + 1);
  const [minX, maxY] = transformedPoint(
    WGS84,
    WEB_MERCATOR,
    northwest.lon,
    northwest.lat,
  );
  const [maxX, minY] = transformedPoint(
    WGS84,
    WEB_MERCATOR,
    southeast.lon,
    southeast.lat,
  );
  return { minX, minY, maxX, maxY };
}

export function targetExtent(
  sourceExtent: Extent,
  targetProjection: TargetProjection,
): Extent {
  const points: Array<[number, number]> = [];
  const steps = 32;
  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    const x =
      sourceExtent.minX + (sourceExtent.maxX - sourceExtent.minX) * fraction;
    const y =
      sourceExtent.minY + (sourceExtent.maxY - sourceExtent.minY) * fraction;
    points.push(
      transformedPoint(WEB_MERCATOR, targetProjection, x, sourceExtent.minY),
      transformedPoint(WEB_MERCATOR, targetProjection, x, sourceExtent.maxY),
      transformedPoint(WEB_MERCATOR, targetProjection, sourceExtent.minX, y),
      transformedPoint(WEB_MERCATOR, targetProjection, sourceExtent.maxX, y),
    );
  }
  return points.reduce<Extent>(
    (extent, [x, y]) => ({
      minX: Math.min(extent.minX, x),
      minY: Math.min(extent.minY, y),
      maxX: Math.max(extent.maxX, x),
      maxY: Math.max(extent.maxY, y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function bilinearSample(
  source: Buffer<ArrayBufferLike>,
  sourceWidth: number,
  sourceHeight: number,
  sourceX: number,
  sourceY: number,
  target: Buffer<ArrayBuffer>,
  targetOffset: number,
): void {
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = Math.min(sourceWidth - 1, x0 + 1);
  const y1 = Math.min(sourceHeight - 1, y0 + 1);
  const xFraction = sourceX - x0;
  const yFraction = sourceY - y0;
  const topLeft = (y0 * sourceWidth + x0) * 4;
  const topRight = (y0 * sourceWidth + x1) * 4;
  const bottomLeft = (y1 * sourceWidth + x0) * 4;
  const bottomRight = (y1 * sourceWidth + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top =
      (source[topLeft + channel] ?? 0) * (1 - xFraction) +
      (source[topRight + channel] ?? 0) * xFraction;
    const bottom =
      (source[bottomLeft + channel] ?? 0) * (1 - xFraction) +
      (source[bottomRight + channel] ?? 0) * xFraction;
    target[targetOffset + channel] = Math.round(
      top * (1 - yFraction) + bottom * yFraction,
    );
  }
}

async function warpWithNode(
  sourcePath: string,
  sourceExtent: Extent,
  projection: TargetProjection,
  extent: Extent,
  width: number,
  height: number,
  outputPath: string,
): Promise<number> {
  const sourceImage = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(width * height * 4);
  const inverseTransform = proj4(projection, WEB_MERCATOR);
  const startedAt = performance.now();

  for (let targetY = 0; targetY < height; targetY += 1) {
    const projectedY =
      extent.maxY - ((targetY + 0.5) / height) * (extent.maxY - extent.minY);
    for (let targetX = 0; targetX < width; targetX += 1) {
      const projectedX =
        extent.minX + ((targetX + 0.5) / width) * (extent.maxX - extent.minX);
      const [sourceCoordinateX, sourceCoordinateY] = inverseTransform.forward([
        projectedX,
        projectedY,
      ]);
      if (
        sourceCoordinateX < sourceExtent.minX ||
        sourceCoordinateX > sourceExtent.maxX ||
        sourceCoordinateY < sourceExtent.minY ||
        sourceCoordinateY > sourceExtent.maxY
      ) {
        continue;
      }
      const sourceX =
        ((sourceCoordinateX - sourceExtent.minX) /
          (sourceExtent.maxX - sourceExtent.minX)) *
          sourceImage.info.width -
        0.5;
      const sourceY =
        ((sourceExtent.maxY - sourceCoordinateY) /
          (sourceExtent.maxY - sourceExtent.minY)) *
          sourceImage.info.height -
        0.5;
      bilinearSample(
        sourceImage.data,
        sourceImage.info.width,
        sourceImage.info.height,
        Math.max(0, Math.min(sourceImage.info.width - 1, sourceX)),
        Math.max(0, Math.min(sourceImage.info.height - 1, sourceY)),
        output,
        (targetY * width + targetX) * 4,
      );
    }
  }

  const elapsed = performance.now() - startedAt;
  await sharp(output, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
  return elapsed;
}

function runCommand(command: string, arguments_: string[]): void {
  const result = spawnSync(command, arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with status ${result.status}: ${result.stderr.trim()}`,
    );
  }
}

function createGeoreferencedSource(
  sourcePath: string,
  sourceExtent: Extent,
  geotiffPath: string,
): void {
  runCommand("gdal_translate", [
    "-q",
    "-of",
    "GTiff",
    "-a_srs",
    WEB_MERCATOR,
    "-a_ullr",
    String(sourceExtent.minX),
    String(sourceExtent.maxY),
    String(sourceExtent.maxX),
    String(sourceExtent.minY),
    sourcePath,
    geotiffPath,
  ]);
}

function warpWithGdal(
  geotiffPath: string,
  projection: TargetProjection,
  extent: Extent,
  width: number,
  height: number,
  outputPath: string,
): { milliseconds: number; maxRssKilobytes: number } {
  const measurementPath = `${outputPath}.time.txt`;
  const startedAt = performance.now();
  runCommand("time", [
    "-f",
    "%M",
    "-o",
    measurementPath,
    "gdalwarp",
    "-q",
    "-overwrite",
    "-multi",
    "-wo",
    "NUM_THREADS=ALL_CPUS",
    "-r",
    "bilinear",
    "-s_srs",
    WEB_MERCATOR,
    "-t_srs",
    projection,
    "-te_srs",
    projection,
    "-te",
    String(extent.minX),
    String(extent.minY),
    String(extent.maxX),
    String(extent.maxY),
    "-ts",
    String(width),
    String(height),
    "-of",
    "PNG",
    geotiffPath,
    outputPath,
  ]);
  const maxRssKilobytes = Number.parseInt(
    readFileSync(measurementPath, "utf8").trim(),
    10,
  );
  if (!Number.isFinite(maxRssKilobytes)) {
    throw new Error("GNU time did not report a valid GDAL peak RSS value.");
  }
  return {
    milliseconds: performance.now() - startedAt,
    maxRssKilobytes,
  };
}

async function compareImages(
  firstPath: string,
  secondPath: string,
): Promise<DifferenceMeasurement> {
  const [first, second] = await Promise.all([
    sharp(firstPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(secondPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (
    first.info.width !== second.info.width ||
    first.info.height !== second.info.height ||
    first.info.channels !== second.info.channels
  ) {
    throw new Error("Reprojection outputs have incompatible dimensions.");
  }

  let totalDifference = 0;
  let maximumChannelDifference = 0;
  let pixelsAboveEight = 0;
  for (
    let pixel = 0;
    pixel < first.info.width * first.info.height;
    pixel += 1
  ) {
    let pixelMaximum = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const index = pixel * 4 + channel;
      const difference = Math.abs(
        (first.data[index] ?? 0) - (second.data[index] ?? 0),
      );
      totalDifference += difference;
      pixelMaximum = Math.max(pixelMaximum, difference);
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
    }
    if (pixelMaximum > 8) {
      pixelsAboveEight += 1;
    }
  }
  const pixelCount = first.info.width * first.info.height;
  return {
    meanAbsoluteChannelDifference: totalDifference / (pixelCount * 4),
    maximumChannelDifference,
    pixelsAboveEight,
    pixelCount,
  };
}

export async function runReprojectionMeasurements(
  nativeOutputPath: string,
): Promise<ReprojectionReport> {
  const sourceExtent = sourceExtent3857();
  const geotiffPath = path.join(OUTPUT_ROOT, "native-3857.tif");
  createGeoreferencedSource(nativeOutputPath, sourceExtent, geotiffPath);

  const measurements: ProjectionMeasurement[] = [];
  for (const projectionCase of PROJECTION_CASES) {
    const { projection, width, height } = projectionCase;
    const extent = targetExtent(sourceExtent, projection);
    const suffix = projection.toLowerCase().replace(":", "-");
    const nodeOutput = path.join(
      OUTPUT_ROOT,
      `node-${suffix}-${width}x${height}.png`,
    );
    const gdalOutput = path.join(
      OUTPUT_ROOT,
      `gdal-${suffix}-${width}x${height}.png`,
    );
    const nodeMilliseconds = await warpWithNode(
      nativeOutputPath,
      sourceExtent,
      projection,
      extent,
      width,
      height,
      nodeOutput,
    );
    const nodeMaxRssKilobytes = process.resourceUsage().maxRSS;
    const gdalMeasurement = warpWithGdal(
      geotiffPath,
      projection,
      extent,
      width,
      height,
      gdalOutput,
    );
    measurements.push({
      targetProjection: projection,
      width,
      height,
      targetExtent: extent,
      nodeOutput,
      gdalOutput,
      nodeMilliseconds,
      gdalMilliseconds: gdalMeasurement.milliseconds,
      nodeMaxRssKilobytes,
      gdalMaxRssKilobytes: gdalMeasurement.maxRssKilobytes,
      difference: await compareImages(nodeOutput, gdalOutput),
    });
  }

  const report: ReprojectionReport = {
    sourceProjection: WEB_MERCATOR,
    sourceExtent,
    measurements,
  };
  await writeFile(
    path.join(OUTPUT_ROOT, "reprojection-measurement.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}
