import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type { MapComparisonPreferences } from "./mapComparisonPreferences.js";

export interface MapComparisonZoomSource {
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
}

export interface MapComparisonZoomRange {
  minimum: number;
  maximum: number;
}

export interface MapComparisonActivationSource extends MapComparisonZoomSource {
  id: string;
  capabilities: {
    interactive: boolean;
  };
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

export function constrainedMapComparisonZoom(
  requestedZoom: number,
  sources: readonly MapComparisonZoomSource[],
): number | null {
  const range = mapComparisonZoomRange(sources);
  if (range === null || range.minimum > range.maximum) return null;
  return Math.min(range.maximum, Math.max(range.minimum, requestedZoom));
}

export function canActivateMapComparison(
  preferences: Pick<MapComparisonPreferences, "count" | "sources">,
  mapSets: readonly MapComparisonActivationSource[],
): boolean {
  const mapSetsById = new Map(mapSets.map((mapSet) => [mapSet.id, mapSet]));
  const sources = preferences.sources
    .slice(0, preferences.count)
    .map(({ mapSetId }) =>
      mapSetId === null ? null : (mapSetsById.get(mapSetId) ?? null),
    );
  if (
    sources.length !== preferences.count ||
    sources.some((source) => source === null)
  ) {
    return false;
  }
  const resolvedSources = sources.filter((source) => source !== null);
  if (resolvedSources.some(({ capabilities }) => !capabilities.interactive)) {
    return false;
  }
  const zoomRange = mapComparisonZoomRange(resolvedSources);
  return zoomRange !== null && zoomRange.minimum <= zoomRange.maximum;
}

export function resolvedMapComparisonPreferences(
  current: MapComparisonPreferences,
  next: MapComparisonPreferences,
  mapSets: readonly MapComparisonActivationSource[],
): MapComparisonPreferences {
  const enabled = next.enabled && canActivateMapComparison(next, mapSets);
  const deactivating = current.enabled && !enabled;
  return {
    ...next,
    enabled,
    ...(deactivating ? { verticalSplit: 50, horizontalSplit: 50 } : {}),
  };
}
