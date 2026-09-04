import type { MapComparisonTileSelection } from "./mapComparisonPreferences.js";

export interface MapTileUrlOptions {
  mapSetId: string;
  cachedTilesOnly: boolean;
  displayGeneration: number;
  tileSelection?: MapComparisonTileSelection;
  missingTile?: "error" | "transparent";
}

export function mapTileUrl({
  mapSetId,
  cachedTilesOnly,
  displayGeneration,
  tileSelection = { kind: "current" },
  missingTile = "error",
}: MapTileUrlOptions): string {
  const url = `api/map-sets/${mapSetId}/tiles/{z}/{x}/{y}`;
  const query: string[] = [];
  if (tileSelection.kind === "snapshot") {
    query.push(`snapshot=${encodeURIComponent(tileSelection.snapshotId)}`);
  } else if (tileSelection.kind === "asOf") {
    query.push(`asOf=${encodeURIComponent(tileSelection.timestamp)}`);
  } else if (cachedTilesOnly) {
    query.push("refresh=cache-only");
    query.push(`displayGeneration=${displayGeneration}`);
  }
  if (missingTile === "transparent") {
    query.push("missing=transparent");
  }
  return query.length === 0 ? url : `${url}?${query.join("&")}`;
}
