import {
  WEB_MERCATOR_MAX_LATITUDE,
  type TileCoordinate,
  wgs84ToXyz,
} from "@maptoy/map-core";

export interface TileCalculatorInput {
  zoom: number;
  longitude: number;
  latitude: number;
}

export function tileCoordinateForLocation(
  input: TileCalculatorInput,
): TileCoordinate | null {
  if (
    !Number.isInteger(input.zoom) ||
    input.zoom < 0 ||
    input.zoom > 24 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude >= 180 ||
    !Number.isFinite(input.latitude) ||
    Math.abs(input.latitude) > WEB_MERCATOR_MAX_LATITUDE
  ) {
    return null;
  }
  const tile = wgs84ToXyz(
    { longitude: input.longitude, latitude: input.latitude },
    input.zoom,
  );
  return { zoom: tile.zoom, x: Math.floor(tile.x), y: Math.floor(tile.y) };
}
