import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import {availableParallelism} from "node:os";
import path from "node:path";
import sharp, {type OverlayOptions} from "sharp";
import {
  ASSET_ROOT,
  ATTRIBUTION,
  MAX_TILE_X,
  MAX_TILE_Y,
  MIN_TILE_X,
  MIN_TILE_Y,
  MOSAIC_HEIGHT,
  MOSAIC_WIDTH,
  OUTPUT_ROOT,
  TILE_ROOT,
  TILE_SIZE,
  ZOOM,
} from "./config.js";
import type {FixturePaths} from "./fixtures.js";
import {lonLatToMosaicPixel} from "./geo.js";
import {assertManagedFixturePath, pluginRegistry} from "./plugins.js";
import type {LayerInstance, RenderContext} from "./types.js";

function attributionOverlay(): OverlayOptions {
  const width = 230;
  const height = 25;
  return {
    input: Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="#ffffff" fill-opacity="0.88"/>
        <text x="8" y="17" font-family="sans-serif" font-size="12" fill="#0f172a">${ATTRIBUTION}</text>
      </svg>
    `),
    left: MOSAIC_WIDTH - width - 8,
    top: MOSAIC_HEIGHT - height - 8,
  };
}

function tileOverlays(): OverlayOptions[] {
  const overlays: OverlayOptions[] = [];
  for (let y = MIN_TILE_Y; y <= MAX_TILE_Y; y += 1) {
    for (let x = MIN_TILE_X; x <= MAX_TILE_X; x += 1) {
      overlays.push({
        input: path.join(TILE_ROOT, `${ZOOM}-${x}-${y}.png`),
        left: (x - MIN_TILE_X) * TILE_SIZE,
        top: (y - MIN_TILE_Y) * TILE_SIZE,
      });
    }
  }
  return overlays;
}

function layerInstances(fixtures: FixturePaths): LayerInstance[] {
  return [
    {
      pluginId: "image-layer",
      configuration: {
        mode: "bounds",
        assetPath: fixtures.boundsImage,
        west: 13.4205,
        east: 13.435,
        north: 52.528,
        south: 52.518,
        opacity: 0.72,
      },
    },
    {
      pluginId: "track-layer",
      configuration: {
        assetPath: fixtures.track,
        color: "#b91c1c",
        width: 5,
      },
    },
    {
      pluginId: "image-layer",
      configuration: {
        mode: "gps",
        assetPath: fixtures.gpsImage,
        width: 72,
      },
    },
  ];
}

async function renderLayers(fixtures: FixturePaths): Promise<OverlayOptions[]> {
  const context: RenderContext = {
    width: MOSAIC_WIDTH,
    height: MOSAIC_HEIGHT,
    lonLatToPixel: lonLatToMosaicPixel,
  };
  const overlays: OverlayOptions[] = [];
  for (const instance of layerInstances(fixtures)) {
    const plugin = pluginRegistry.get(instance.pluginId);
    if (plugin === undefined) {
      throw new Error(`Layer plugin is not registered: ${instance.pluginId}`);
    }
    if (
      typeof instance.configuration === "object" &&
      instance.configuration !== null &&
      "assetPath" in instance.configuration &&
      typeof instance.configuration.assetPath === "string"
    ) {
      assertManagedFixturePath(ASSET_ROOT, instance.configuration.assetPath);
    }
    const configuration = plugin.validate(instance.configuration);
    overlays.push(...(await plugin.render(context, configuration)));
  }
  return overlays;
}

export async function renderNative(
  fixtures: FixturePaths,
  outputPath?: string,
): Promise<Buffer> {
  const layers = await renderLayers(fixtures);
  const result = await sharp({
    create: {
      width: MOSAIC_WIDTH,
      height: MOSAIC_HEIGHT,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite([...tileOverlays(), ...layers, attributionOverlay()])
    .png()
    .toBuffer();
  if (outputPath !== undefined) {
    await writeFile(outputPath, result);
  }
  return result;
}

export interface NativeMeasurement {
  output: string;
  width: number;
  height: number;
  repetitions: number;
  elapsedMilliseconds: number[];
  averageMilliseconds: number;
  maxRssKilobytes: number;
  encodedBytes: number;
  sha256: string;
  node: string;
  platform: NodeJS.Platform;
  architecture: string;
  cpuCount: number;
}

export async function runNativeMeasurement(
  fixtures: FixturePaths,
): Promise<NativeMeasurement> {
  await mkdir(OUTPUT_ROOT, {recursive: true});
  await renderNative(fixtures);

  const elapsedMilliseconds: number[] = [];
  let result: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  for (let repetition = 0; repetition < 10; repetition += 1) {
    const startedAt = performance.now();
    result = await renderNative(fixtures);
    elapsedMilliseconds.push(performance.now() - startedAt);
  }

  const output = path.join(OUTPUT_ROOT, "native-3857.png");
  await writeFile(output, result);
  const metadata = await sharp(result).metadata();
  if (metadata.width !== MOSAIC_WIDTH || metadata.height !== MOSAIC_HEIGHT) {
    throw new Error(
      `Unexpected native output size: ${metadata.width}x${metadata.height}`,
    );
  }

  const report: NativeMeasurement = {
    output,
    width: metadata.width,
    height: metadata.height,
    repetitions: elapsedMilliseconds.length,
    elapsedMilliseconds,
    averageMilliseconds:
      elapsedMilliseconds.reduce((sum, value) => sum + value, 0) /
      elapsedMilliseconds.length,
    maxRssKilobytes: process.resourceUsage().maxRSS,
    encodedBytes: result.byteLength,
    sha256: createHash("sha256").update(result).digest("hex"),
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpuCount: availableParallelism(),
  };
  await writeFile(
    path.join(OUTPUT_ROOT, "native-measurement.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}
