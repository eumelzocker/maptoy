export const XYZ_TILE_SIZE = 256;
export const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;

export interface Wgs84Coordinate {
  longitude: number;
  latitude: number;
}

export interface TileCoordinate {
  zoom: number;
  x: number;
  y: number;
}

export function wgs84ToXyz(
  coordinate: Wgs84Coordinate,
  zoom: number,
): TileCoordinate {
  const scale = 2 ** zoom;
  const latitude = Math.max(
    -WEB_MERCATOR_MAX_LATITUDE,
    Math.min(WEB_MERCATOR_MAX_LATITUDE, coordinate.latitude),
  );
  const latitudeRadians = (latitude * Math.PI) / 180;

  return {
    zoom,
    x: ((coordinate.longitude + 180) / 360) * scale,
    y: ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale,
  };
}
