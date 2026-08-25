import sharp from "sharp";

export type ErrorTileType = "no_cache";

export interface GenerateErrorTileOptions {
  type: ErrorTileType;
  tileSize: 256 | 512;
  zoom: number;
  x: number;
  y: number;
}

const errorTileCache = new Map<string, Promise<Buffer>>();
const maximumCachedErrorTiles = 512;

function errorTileSvg({
  type,
  tileSize,
  zoom,
  x,
  y,
}: GenerateErrorTileOptions): Buffer {
  if (type !== "no_cache") {
    throw new Error(`Unsupported error tile type: ${type satisfies never}`);
  }

  const fontSize = tileSize / 16;
  const lineHeight = fontSize * 1.25;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">
      <defs>
        <pattern id="no-cache" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#e7eee9" />
          <path d="M -16 -16 L 48 48 M -48 -16 L 16 48 M 16 -16 L 48 16" stroke="#a6c4b5" stroke-width="12" />
        </pattern>
      </defs>
      <rect width="${tileSize}" height="${tileSize}" fill="url(#no-cache)" />
      <rect x="22%" y="32%" width="56%" height="36%" rx="${tileSize / 32}" fill="#163832" fill-opacity="0.9" />
      <text x="50%" y="50%" fill="#f5f7ed" font-family="monospace" font-size="${fontSize}" font-weight="700" text-anchor="middle">
        <tspan x="50%" dy="-${lineHeight}">z ${zoom}</tspan>
        <tspan x="50%" dy="${lineHeight}">x ${x}</tspan>
        <tspan x="50%" dy="${lineHeight}">y ${y}</tspan>
      </text>
    </svg>
  `);
}

export function generateErrorTile(
  options: GenerateErrorTileOptions,
): Promise<Buffer> {
  const cacheKey = `${options.type}:${options.tileSize}:${options.zoom}:${options.x}:${options.y}`;
  const cached = errorTileCache.get(cacheKey);
  if (cached !== undefined) {
    errorTileCache.delete(cacheKey);
    errorTileCache.set(cacheKey, cached);
    return cached;
  }

  const generated = sharp(errorTileSvg(options)).png().toBuffer();
  errorTileCache.set(cacheKey, generated);
  if (errorTileCache.size > maximumCachedErrorTiles) {
    const oldestKey = errorTileCache.keys().next().value;
    if (oldestKey !== undefined) {
      errorTileCache.delete(oldestKey);
    }
  }
  generated.catch(() => errorTileCache.delete(cacheKey));
  return generated;
}
