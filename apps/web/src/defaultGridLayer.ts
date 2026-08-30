import type { Layer } from "@maptoy/contracts";
import { TILE_GRID_LAYER_PLUGIN_ID } from "@maptoy/tile-grid-layer";

export const DEFAULT_GRID_LAYER_NAME = "Default Grid";

export function findDefaultGridLayer(layers: readonly Layer[]): Layer | null {
  return (
    layers.find(
      ({ name, pluginId }) =>
        name === DEFAULT_GRID_LAYER_NAME &&
        pluginId === TILE_GRID_LAYER_PLUGIN_ID,
    ) ?? null
  );
}
