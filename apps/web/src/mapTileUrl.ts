import type { MapComparisonTileSelection } from "./mapComparisonPreferences.js";

export interface MapTileUrlOptions {
  mapSetId: string;
  cachedTilesOnly: boolean;
  displayGeneration: number;
  tileSelection?: MapComparisonTileSelection;
}

export function mapTileUrl({
  mapSetId,
  cachedTilesOnly,
  displayGeneration,
  tileSelection = { kind: "current" },
}: MapTileUrlOptions): string {
  const url = `api/map-sets/${mapSetId}/tiles/{z}/{x}/{y}`;
  if (tileSelection.kind === "snapshot") {
    return `${url}?snapshot=${encodeURIComponent(tileSelection.snapshotId)}`;
  }
  if (tileSelection.kind === "asOf") {
    return `${url}?asOf=${encodeURIComponent(tileSelection.timestamp)}`;
  }
  return cachedTilesOnly
    ? `${url}?refresh=cache-only&displayGeneration=${displayGeneration}`
    : url;
}
