import type { MapSetListItem } from "@maptoy/contracts";
import { groupMapSetsByFirstNameSegment } from "./mapSetNameGroups.js";
import type { MenuItem } from "./menuModels.js";

export function createMapSetMenuItems(
  mapSets: readonly MapSetListItem[],
  selectedId: string | null,
): MenuItem[] {
  return groupMapSetsByFirstNameSegment(mapSets).map((group) => ({
    id: group.key,
    label: group.label,
    icon: group.ungrouped ? "mdi-format-list-bulleted" : "mdi-folder-outline",
    selected: group.items.some(({ mapSet }) => mapSet.id === selectedId),
    children: group.items.map(({ mapSet, label }) => ({
      id: mapSet.id,
      label,
      title: mapSet.name,
      selected: mapSet.id === selectedId,
    })),
  }));
}
