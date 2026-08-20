import {spawnSync} from "node:child_process";
import {mkdir, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ARTIFACT_ROOT,
  ASSET_ROOT,
  MAX_TILE_X,
  MAX_TILE_Y,
  MIN_TILE_X,
  MIN_TILE_Y,
  TILE_ROOT,
  TILE_SIZE,
  ZOOM,
} from "./config.js";

const COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#cffafe",
  "#ffedd5",
  "#e2e8f0",
  "#f3e8ff",
];

export interface FixturePaths {
  track: string;
  gpsImage: string;
  boundsImage: string;
}

function tileSvg(x: number, y: number, color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}">
      <rect width="100%" height="100%" fill="${color}"/>
      <path d="M0 0L${TILE_SIZE} ${TILE_SIZE}M${TILE_SIZE} 0L0 ${TILE_SIZE}" stroke="#64748b" stroke-width="2"/>
      <path d="M64 0V${TILE_SIZE}M128 0V${TILE_SIZE}M192 0V${TILE_SIZE}M0 64H${TILE_SIZE}M0 128H${TILE_SIZE}M0 192H${TILE_SIZE}" stroke="#94a3b8" stroke-width="1"/>
      <rect x="2" y="2" width="252" height="252" fill="none" stroke="#0f172a" stroke-width="4"/>
      <circle cx="128" cy="128" r="9" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>
      <text x="128" y="105" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="700" fill="#0f172a">${ZOOM}/${x}/${y}</text>
    </svg>
  `;
}

async function generateTiles(): Promise<void> {
  let colorIndex = 0;
  for (let y = MIN_TILE_Y; y <= MAX_TILE_Y; y += 1) {
    for (let x = MIN_TILE_X; x <= MAX_TILE_X; x += 1) {
      const color = COLORS[colorIndex];
      if (color === undefined) {
        throw new Error("The fixture palette is too small for the tile grid.");
      }
      await sharp(Buffer.from(tileSvg(x, y, color)))
        .png()
        .toFile(path.join(TILE_ROOT, `${ZOOM}-${x}-${y}.png`));
      colorIndex += 1;
    }
  }
}

async function generateTrack(): Promise<string> {
  const trackPath = path.join(ASSET_ROOT, "track.geojson");
  const track = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {name: "Synthetic tile-boundary track"},
        geometry: {
          type: "LineString",
          coordinates: [
            [13.385, 52.532],
            [13.404, 52.521],
            [13.426, 52.514],
            [13.443, 52.499],
          ],
        },
      },
    ],
  };
  await writeFile(trackPath, `${JSON.stringify(track, null, 2)}\n`);
  return trackPath;
}

async function generateGpsImage(): Promise<string> {
  const imagePath = path.join(ASSET_ROOT, "gps-image.jpg");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
      <rect width="120" height="80" fill="#1d4ed8"/>
      <path d="M12 65L42 30L61 50L79 20L108 65Z" fill="#bfdbfe"/>
      <circle cx="28" cy="21" r="9" fill="#facc15"/>
      <text x="60" y="75" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#ffffff">GPS</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).jpeg({quality: 90}).toFile(imagePath);

  const result = spawnSync(
    "exiftool",
    [
      "-overwrite_original",
      "-n",
      "-GPSLatitude=52.5205",
      "-GPSLongitude=13.405",
      "-GPSLatitudeRef=N",
      "-GPSLongitudeRef=E",
      "-Orientation#=6",
      imagePath,
    ],
    {encoding: "utf8"},
  );
  if (result.status !== 0) {
    throw new Error(`ExifTool failed: ${result.stderr.trim()}`);
  }
  return imagePath;
}

async function generateBoundsImage(): Promise<string> {
  const imagePath = path.join(ASSET_ROOT, "bounds-image.png");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="100">
      <rect x="2" y="2" width="156" height="96" rx="10" fill="#f97316" fill-opacity="0.68" stroke="#7c2d12" stroke-width="4"/>
      <text x="80" y="57" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#431407">BOUNDS</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  return imagePath;
}

export async function generateFixtures(): Promise<FixturePaths> {
  await rm(ARTIFACT_ROOT, {recursive: true, force: true});
  await mkdir(ARTIFACT_ROOT, {recursive: true});
  await mkdir(TILE_ROOT, {recursive: true});
  await mkdir(ASSET_ROOT, {recursive: true});
  await generateTiles();

  const [track, gpsImage, boundsImage] = await Promise.all([
    generateTrack(),
    generateGpsImage(),
    generateBoundsImage(),
  ]);

  return {track, gpsImage, boundsImage};
}
