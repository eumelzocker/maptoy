export const XYZ_TILE_SIZE = 256;
export const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;
const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

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

function normalizedLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) {
    return longitude;
  }
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

export function minimalWgs84Bounds(
  coordinates: readonly Wgs84Coordinate[],
): Wgs84Bounds | null {
  if (coordinates.length === 0) {
    return null;
  }
  const longitudes = coordinates
    .map(({ longitude }) => normalizedLongitude(longitude))
    .sort((left, right) => left - right);
  let largestGap = -1;
  let largestGapStart = 0;
  for (let index = 0; index < longitudes.length; index += 1) {
    const current = longitudes[index] as number;
    const next =
      index + 1 < longitudes.length
        ? (longitudes[index + 1] as number)
        : (longitudes[0] as number) + 360;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapStart = index;
    }
  }
  const west = normalizedLongitude(
    largestGapStart + 1 < longitudes.length
      ? (longitudes[largestGapStart + 1] as number)
      : (longitudes[0] as number),
  );
  const east = normalizedLongitude(longitudes[largestGapStart] as number);
  let south = coordinates[0]?.latitude as number;
  let north = south;
  for (let index = 1; index < coordinates.length; index += 1) {
    const latitude = coordinates[index]?.latitude as number;
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return {
    west,
    south,
    east,
    north,
  };
}

export interface XyzTileRange {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

export interface MetricScaleBar {
  distanceMeters: number;
  width: number;
  label: string;
}

export const METRIC_SCALE_INTERMEDIATE_LABEL_COUNT = 3;
export const METRIC_SCALE_SUBDIVISIONS_PER_INTERVAL = 10;

export interface SegmentedMetricScaleMark {
  distanceMeters: number;
  position: number;
  label: string;
}

export interface SegmentedMetricScaleSection {
  distanceMeters: number;
  width: number;
  dark: boolean;
}

export interface SegmentedMetricScale {
  distanceMeters: number;
  intervalMeters: number;
  marks: readonly SegmentedMetricScaleMark[];
  sections: readonly SegmentedMetricScaleSection[];
}

export function geodesicDistanceMeters(
  first: Wgs84Coordinate,
  second: Wgs84Coordinate,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = radians(second.longitude - first.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 * EARTH_MEAN_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}

export function metricScaleBar(
  maximumDistanceMeters: number,
  maximumWidth: number,
): MetricScaleBar {
  if (
    !Number.isFinite(maximumDistanceMeters) ||
    maximumDistanceMeters <= 0 ||
    !Number.isFinite(maximumWidth) ||
    maximumWidth <= 0
  ) {
    throw new Error("Scale bar dimensions must be positive finite numbers.");
  }
  const exponent = 10 ** Math.floor(Math.log10(maximumDistanceMeters));
  const normalized = maximumDistanceMeters / exponent;
  const leading = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  const distanceMeters = leading * exponent;
  const width = (distanceMeters / maximumDistanceMeters) * maximumWidth;
  return {
    distanceMeters,
    width,
    label:
      distanceMeters >= 1000
        ? `${distanceMeters / 1000} km`
        : `${distanceMeters} m`,
  };
}

function formatMetricScaleDistance(
  distanceMeters: number,
  scaleDistanceMeters: number,
  includeUnit: boolean,
): string {
  const usesKilometers = scaleDistanceMeters >= 1000;
  const value = Number(
    (usesKilometers ? distanceMeters / 1000 : distanceMeters).toFixed(1),
  );
  return includeUnit ? `${value} ${usesKilometers ? "km" : "m"}` : `${value}`;
}

function roundedMetricScaleDistance(distanceMeters: number): number {
  const rounding =
    distanceMeters >= 10_000
      ? 1000
      : distanceMeters >= 1000
        ? 100
        : distanceMeters >= 100
          ? 10
          : 1;
  return Math.max(rounding, Math.round(distanceMeters / rounding) * rounding);
}

function metricScaleInterval(distanceMeters: number): number {
  const target = distanceMeters / (METRIC_SCALE_INTERMEDIATE_LABEL_COUNT + 1);
  const exponent = 10 ** Math.floor(Math.log10(target));
  const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map(
    (value) => value * exponent,
  );
  const valid = candidates.filter(
    (value) => value * METRIC_SCALE_INTERMEDIATE_LABEL_COUNT < distanceMeters,
  );
  return valid.reduce((nearest, candidate) =>
    Math.abs(candidate - target) < Math.abs(nearest - target)
      ? candidate
      : nearest,
  );
}

export function segmentedMetricScale(
  maximumDistanceMeters: number,
): SegmentedMetricScale {
  if (!Number.isFinite(maximumDistanceMeters) || maximumDistanceMeters <= 0) {
    throw new Error("Scale distance must be a positive finite number.");
  }
  const distanceMeters = roundedMetricScaleDistance(maximumDistanceMeters);
  const intervalMeters = metricScaleInterval(distanceMeters);
  const subdivisionMeters =
    intervalMeters / METRIC_SCALE_SUBDIVISIONS_PER_INTERVAL;
  const fullSectionCount = Math.floor(
    distanceMeters / subdivisionMeters + Number.EPSILON,
  );
  const sections: SegmentedMetricScaleSection[] = Array.from(
    { length: fullSectionCount },
    (_, index) => ({
      distanceMeters: subdivisionMeters,
      width: subdivisionMeters / distanceMeters,
      dark: index % 2 === 0,
    }),
  );
  const coveredDistance = fullSectionCount * subdivisionMeters;
  const remainder = distanceMeters - coveredDistance;
  if (remainder > Number.EPSILON * distanceMeters) {
    sections.push({
      distanceMeters: remainder,
      width: remainder / distanceMeters,
      dark: fullSectionCount % 2 === 0,
    });
  }
  const marks = Array.from(
    { length: METRIC_SCALE_INTERMEDIATE_LABEL_COUNT },
    (_, index) => {
      const distance = intervalMeters * (index + 1);
      return {
        distanceMeters: distance,
        position: distance / distanceMeters,
        label: formatMetricScaleDistance(distance, distanceMeters, false),
      };
    },
  );
  marks.push({
    distanceMeters,
    position: 1,
    label: formatMetricScaleDistance(distanceMeters, distanceMeters, true),
  });
  return { distanceMeters, intervalMeters, marks, sections };
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

export function xyzToWgs84(tile: TileCoordinate): Wgs84Coordinate {
  const scale = 2 ** tile.zoom;
  const mercator = Math.PI * (1 - (2 * tile.y) / scale);
  return {
    longitude: (tile.x / scale) * 360 - 180,
    latitude: (Math.atan(Math.sinh(mercator)) * 180) / Math.PI,
  };
}

export function xyzTileBounds(tile: TileCoordinate): Wgs84Bounds {
  const northwest = xyzToWgs84(tile);
  const southeast = xyzToWgs84({
    zoom: tile.zoom,
    x: tile.x + 1,
    y: tile.y + 1,
  });
  return {
    west: northwest.longitude,
    south: southeast.latitude,
    east: southeast.longitude,
    north: northwest.latitude,
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

export function xyzTileRangeCount(range: XyzTileRange): number {
  return (
    (range.maximumX - range.minimumX + 1) *
    (range.maximumY - range.minimumY + 1)
  );
}

export function wgs84BoundsXyzTileCount(
  bounds: Wgs84Bounds,
  minimumZoom: number,
  maximumZoom: number,
): number {
  if (
    !Number.isInteger(minimumZoom) ||
    !Number.isInteger(maximumZoom) ||
    minimumZoom < 0 ||
    maximumZoom < minimumZoom
  ) {
    throw new Error("Tile zoom range is invalid.");
  }
  let total = 0;
  for (let zoom = minimumZoom; zoom <= maximumZoom; zoom += 1) {
    total += wgs84BoundsToXyzTileRanges(bounds, zoom).reduce(
      (count, range) => count + xyzTileRangeCount(range),
      0,
    );
  }
  return total;
}

export function* wgs84BoundsXyzTiles(
  bounds: Wgs84Bounds,
  minimumZoom: number,
  maximumZoom: number,
): Generator<TileCoordinate> {
  wgs84BoundsXyzTileCount(bounds, minimumZoom, maximumZoom);
  for (let zoom = minimumZoom; zoom <= maximumZoom; zoom += 1) {
    for (const range of wgs84BoundsToXyzTileRanges(bounds, zoom)) {
      for (let y = range.minimumY; y <= range.maximumY; y += 1) {
        for (let x = range.minimumX; x <= range.maximumX; x += 1) {
          yield { zoom, x, y };
        }
      }
    }
  }
}
