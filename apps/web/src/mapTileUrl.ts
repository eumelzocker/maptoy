export interface MapTileUrlOptions {
  mapSetId: string;
  cachedTilesOnly: boolean;
  displayGeneration: number;
}

export function mapTileUrl({
  mapSetId,
  cachedTilesOnly,
  displayGeneration,
}: MapTileUrlOptions): string {
  const url = `api/map-sets/${mapSetId}/tiles/{z}/{x}/{y}`;
  return cachedTilesOnly
    ? `${url}?refresh=cache-only&displayGeneration=${displayGeneration}`
    : url;
}
