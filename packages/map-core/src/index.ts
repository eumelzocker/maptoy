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

export interface Wgs84Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface XyzTileRange {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
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

export function xyzTileBounds(tile: TileCoordinate): Wgs84Bounds {
  const scale = 2 ** tile.zoom;
  const longitude = (x: number) => (x / scale) * 360 - 180;
  const latitude = (y: number) => {
    const mercator = Math.PI * (1 - (2 * y) / scale);
    return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
  };
  return {
    west: longitude(tile.x),
    south: latitude(tile.y + 1),
    east: longitude(tile.x + 1),
    north: latitude(tile.y),
  };
}

export function wgs84BoundsToXyzTileRanges(
  bounds: Wgs84Bounds,
  zoom: number,
): XyzTileRange[] {
  if (bounds.south >= bounds.north) {
    throw new Error("Bounds north must be greater than south.");
  }
  const scale = 2 ** zoom;
  // Inverse Mercator calculations can land a few ulps next to an exact Tile
  // boundary. Keep exact bounds from accidentally including a neighbouring row.
  const lowerTileIndex = (value: number) => Math.floor(value + 1e-10);
  const upperTileIndex = (value: number) => Math.ceil(value - 1e-10) - 1;
  const clampedNorth = Math.min(WEB_MERCATOR_MAX_LATITUDE, bounds.north);
  const clampedSouth = Math.max(-WEB_MERCATOR_MAX_LATITUDE, bounds.south);
  const minimumY = Math.max(
    0,
    Math.min(
      scale - 1,
      lowerTileIndex(
        wgs84ToXyz({ longitude: 0, latitude: clampedNorth }, zoom).y,
      ),
    ),
  );
  const maximumY = Math.max(
    minimumY,
    Math.min(
      scale - 1,
      upperTileIndex(
        wgs84ToXyz({ longitude: 0, latitude: clampedSouth }, zoom).y,
      ),
    ),
  );
  const xRange = (west: number, east: number): XyzTileRange => ({
    minimumX: Math.max(
      0,
      Math.min(scale - 1, lowerTileIndex(((west + 180) / 360) * scale)),
    ),
    maximumX: Math.max(
      0,
      Math.min(scale - 1, upperTileIndex(((east + 180) / 360) * scale)),
    ),
    minimumY,
    maximumY,
  });
  return bounds.west < bounds.east
    ? [xRange(bounds.west, bounds.east)]
    : [xRange(bounds.west, 180), xRange(-180, bounds.east)];
}
