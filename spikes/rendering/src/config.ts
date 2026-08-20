import { fileURLToPath } from "node:url";
import path from "node:path";

export const TILE_SIZE = 256;
export const ZOOM = 14;
export const MIN_TILE_X = 8801;
export const MAX_TILE_X = 8803;
export const MIN_TILE_Y = 5372;
export const MAX_TILE_Y = 5374;
export const MOSAIC_WIDTH = (MAX_TILE_X - MIN_TILE_X + 1) * TILE_SIZE;
export const MOSAIC_HEIGHT = (MAX_TILE_Y - MIN_TILE_Y + 1) * TILE_SIZE;

export const SPIKE_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const ARTIFACT_ROOT = path.join(SPIKE_ROOT, ".artifacts");
export const TILE_ROOT = path.join(ARTIFACT_ROOT, "tiles");
export const ASSET_ROOT = path.join(ARTIFACT_ROOT, "assets");
export const OUTPUT_ROOT = path.join(ARTIFACT_ROOT, "output");

export const ATTRIBUTION = "Synthetic maptoy test data";
