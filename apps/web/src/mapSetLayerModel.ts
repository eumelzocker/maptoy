import type { MapSetListItem } from "@maptoy/contracts";
import type { MapXyzTileLayerData } from "@maptoy/map-adapter-sdk";
import { mapTileUrl } from "./mapTileUrl.js";

export interface ResolvedMapSetLayerOptions {
  mapSet: Pick<MapSetListItem, "id" | "minZoom" | "maxZoom" | "tileSize">;
  allowProviderRequests: boolean;
  cachedTilesOnly: boolean;
  displayGeneration: number;
}

export function resolvedMapSetLayerData({
  mapSet,
  allowProviderRequests,
  cachedTilesOnly,
  displayGeneration,
}: ResolvedMapSetLayerOptions): MapXyzTileLayerData {
  return {
    kind: "xyz-tile-layer",
    tileUrl: mapTileUrl({
      mapSetId: mapSet.id,
      cachedTilesOnly: cachedTilesOnly || !allowProviderRequests,
      displayGeneration,
      missingTile: "transparent",
    }),
    minZoom: mapSet.minZoom,
    maxZoom: mapSet.maxZoom,
    tileSize: mapSet.tileSize,
  };
}
