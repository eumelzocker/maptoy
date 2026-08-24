import type { MapSetListItem } from "@maptoy/contracts";
import { sortDocumentationPages } from "./documentationNavigation.js";
import { createMapSetMenuItems } from "./mapSetMenuItems.js";
import type { MenuItem } from "./menuModels.js";

interface DocumentationMenuPage {
  id: string;
  title: string;
}

interface MapContextMenuState {
  mapSets: readonly MapSetListItem[];
  selectedMapSetId: string | null;
  minimumZoom: number | null;
  maximumZoom: number | null;
  currentZoom: number | null;
  documentationLanguage: string;
  documentationPages: readonly DocumentationMenuPage[];
  toolsEnabled: boolean;
  showTitleBar: boolean;
  showMapSelector: boolean;
  showCoordinates: boolean;
  showAttribution: boolean;
}

export const mapContextMenuIds = {
  mapSetPrefix: "select-map-set:",
  zoomPrefix: "select-zoom:",
  mapSets: "goto-map-sets",
  tileCache: "goto-tile-cache",
  documentationPrefix: "goto-documentation:",
  gotoCoordinates: "tool-goto-coordinates",
  tileCalculator: "tool-tile-calculator",
  showTitleBar: "option-show-title-bar",
  showMapSelector: "option-show-map-selector",
  showCoordinates: "option-show-coordinates",
  showAttribution: "option-show-attribution",
} as const;

export function createMapContextMenuItems(
  state: MapContextMenuState,
): MenuItem[] {
  const mapSetItems = createMapSetMenuItems(
    state.mapSets,
    state.selectedMapSetId,
  ).map((group) => ({
    ...group,
    id: `map-set-group:${group.id}`,
    children: (group.children ?? []).map((item) => ({
      ...item,
      id: `${mapContextMenuIds.mapSetPrefix}${item.id}`,
    })),
  }));
  const zoomValues: number[] = [];
  if (
    state.minimumZoom !== null &&
    state.maximumZoom !== null &&
    state.maximumZoom >= state.minimumZoom
  ) {
    for (let zoom = state.minimumZoom; zoom <= state.maximumZoom; zoom += 1) {
      zoomValues.push(zoom);
    }
  }
  const zoomItems = zoomValues.map((zoom) => ({
    id: `${mapContextMenuIds.zoomPrefix}${zoom}`,
    label: String(zoom),
    selected: zoom === state.currentZoom,
  }));
  const documentationItems = sortDocumentationPages(
    state.documentationPages,
    state.documentationLanguage,
  ).map(({ id, title }) => ({
    id: `${mapContextMenuIds.documentationPrefix}${id}`,
    label: title,
    icon: id === "home" ? "mdi-map-legend" : "mdi-file-document-outline",
  }));

  return [
    {
      id: "map-set",
      label: "Map Set",
      icon: "mdi-layers-outline",
      disabled: mapSetItems.length === 0,
      children: mapSetItems,
    },
    {
      id: "zoom",
      label: "Zoom",
      icon: "mdi-magnify",
      disabled: zoomItems.length === 0 || state.currentZoom === null,
      children: zoomItems,
    },
    {
      id: "goto",
      label: "Goto",
      icon: "mdi-arrow-right-bold-box-outline",
      children: [
        {
          id: mapContextMenuIds.mapSets,
          label: "Map Sets",
          icon: "mdi-layers-outline",
        },
        {
          id: mapContextMenuIds.tileCache,
          label: "Tile Cache",
          icon: "mdi-database-outline",
        },
        {
          id: "goto-documentation",
          label: "Documentation",
          icon: "mdi-book-open-page-variant-outline",
          children: documentationItems,
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      icon: "mdi-tools",
      children: [
        {
          id: mapContextMenuIds.gotoCoordinates,
          label: "Goto Coordinates",
          icon: "mdi-crosshairs-gps",
          disabled: !state.toolsEnabled,
        },
        {
          id: mapContextMenuIds.tileCalculator,
          label: "Tile Calculator",
          icon: "mdi-grid",
          disabled: !state.toolsEnabled,
        },
      ],
    },
    {
      id: "options",
      label: "Options",
      icon: "mdi-tune",
      children: [
        {
          id: mapContextMenuIds.showTitleBar,
          label: "Show Title Bar",
          checked: state.showTitleBar,
        },
        {
          id: mapContextMenuIds.showMapSelector,
          label: "Show Map Selector",
          checked: state.showMapSelector,
        },
        {
          id: mapContextMenuIds.showCoordinates,
          label: "Show Coordinates",
          checked: state.showCoordinates,
        },
        {
          id: mapContextMenuIds.showAttribution,
          label: "Show Attribution",
          checked: state.showAttribution,
        },
      ],
    },
  ];
}
