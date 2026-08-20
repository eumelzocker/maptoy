import { MIN_TILE_X, MIN_TILE_Y, TILE_SIZE, ZOOM } from "./config.js";

const MAX_MERCATOR_LATITUDE = 85.0511287798066;

export interface LonLat {
  lon: number;
  lat: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

export function lonLatToWorldPixel(
  { lon, lat }: LonLat,
  zoom = ZOOM,
): PixelPoint {
  const clampedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, lat),
  );
  const latitudeRadians = (clampedLatitude * Math.PI) / 180;
  const size = worldSize(zoom);

  return {
    x: ((lon + 180) / 360) * size,
    y: ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * size,
  };
}

export function worldPixelToLonLat({ x, y }: PixelPoint, zoom = ZOOM): LonLat {
  const size = worldSize(zoom);
  const longitude = (x / size) * 360 - 180;
  const latitudeRadians = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size)));

  return {
    lon: longitude,
    lat: (latitudeRadians * 180) / Math.PI,
  };
}

export function lonLatToMosaicPixel(coordinate: LonLat): PixelPoint {
  const worldPixel = lonLatToWorldPixel(coordinate);
  return {
    x: worldPixel.x - MIN_TILE_X * TILE_SIZE,
    y: worldPixel.y - MIN_TILE_Y * TILE_SIZE,
  };
}

export function tileCornerToLonLat(x: number, y: number): LonLat {
  return worldPixelToLonLat({ x: x * TILE_SIZE, y: y * TILE_SIZE });
}
