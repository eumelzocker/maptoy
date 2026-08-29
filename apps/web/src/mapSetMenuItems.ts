import type { MapSetListItem } from "@maptoy/contracts";
import { createMapSetNameEntries } from "./mapSetNameGroups.js";
import type { MenuItem } from "./menuModels.js";

export function createMapSetMenuItems(
  mapSets: readonly MapSetListItem[],
  selectedId: string | null,
): MenuItem[] {
  return createMapSetNameEntries(mapSets).map((entry) =>
    entry.kind === "map-set"
      ? {
          id: entry.mapSet.id,
          label: entry.label,
          title: entry.mapSet.name,
          selected: entry.mapSet.id === selectedId,
        }
      : {
          id: entry.key,
          label: entry.label,
          icon: entry.virtual
            ? "mdi-format-list-bulleted"
            : "mdi-folder-outline",
          selected: entry.items.some(({ mapSet }) => mapSet.id === selectedId),
          children: entry.items.map(({ mapSet, label }) => ({
            id: mapSet.id,
            label,
            title: mapSet.name,
            selected: mapSet.id === selectedId,
          })),
        },
  );
}
