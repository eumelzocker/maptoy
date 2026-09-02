import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";

export interface MapComparisonZoomSource {
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
}

export interface MapComparisonZoomRange {
  minimum: number;
  maximum: number;
}

export function mapComparisonZoomRange(
  sources: readonly MapComparisonZoomSource[],
): MapComparisonZoomRange | null {
  if (sources.length === 0) return null;
  const ranges = sources.map((source) => leafletXyzZoomOptions(source));
  return {
    minimum: Math.max(...ranges.map(({ minZoom }) => minZoom)),
    maximum: Math.min(...ranges.map(({ maxZoom }) => maxZoom)),
  };
}
