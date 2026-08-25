import type { TileCacheZoomStats } from "@maptoy/contracts";

export interface CacheCoverageMapSet {
  minZoom: number;
  maxZoom: number;
}

export interface CacheCoverageLevel extends TileCacheZoomStats {
  supportedMapSetCount: number;
  possibleTileCount: bigint;
  coveragePercent: number | null;
}

const emptyStats = (zoom: number): TileCacheZoomStats => ({
  zoom,
  logicalTileCount: 0,
  currentRevisionCount: 0,
  historicalRevisionCount: 0,
  totalRevisionCount: 0,
  indexedStorageBytes: 0,
});

export function cacheCoverageByZoom(
  zoomStats: readonly TileCacheZoomStats[],
  mapSets: readonly CacheCoverageMapSet[],
): CacheCoverageLevel[] {
  const statsByZoom = new Map(zoomStats.map((level) => [level.zoom, level]));
  const zooms = [
    ...zoomStats.map(({ zoom }) => zoom),
    ...mapSets.flatMap(({ minZoom, maxZoom }) => [minZoom, maxZoom]),
  ];
  if (zooms.length === 0) return [];

  const minimumZoom = Math.min(...zooms);
  const maximumZoom = Math.max(...zooms);
  const levels: CacheCoverageLevel[] = [];

  for (let zoom = minimumZoom; zoom <= maximumZoom; zoom += 1) {
    const stats = statsByZoom.get(zoom) ?? emptyStats(zoom);
    const supportedMapSetCount = mapSets.filter(
      ({ minZoom, maxZoom }) => zoom >= minZoom && zoom <= maxZoom,
    ).length;
    const possibleTileCount = 4n ** BigInt(zoom) * BigInt(supportedMapSetCount);

    levels.push({
      ...stats,
      supportedMapSetCount,
      possibleTileCount,
      coveragePercent:
        possibleTileCount === 0n
          ? null
          : (100 * stats.logicalTileCount) / Number(possibleTileCount),
    });
  }

  return levels;
}

export function formatCoveragePercent(value: number | null): string {
  if (value === null) return "n/a";
  if (value === 0) return "0 %";
  if (value >= 0.01) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  if (value >= 0.0001) {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value / 100);
  }
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    notation: "scientific",
    maximumFractionDigits: 2,
  }).format(value / 100);
}
