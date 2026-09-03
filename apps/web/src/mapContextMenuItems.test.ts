import type { MapSetListItem } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import {
  createMapContextMenuItems,
  mapContextMenuIds,
} from "./mapContextMenuItems.js";

describe("Map context menu items", () => {
  it("builds navigation, tools, and checked display options", () => {
    const items = createMapContextMenuItems({
      mapSets: [
        { id: "streets", name: "Provider/Streets" },
        { id: "satellite", name: "Provider/Satellite" },
        { id: "root", name: "Root Map" },
      ] as MapSetListItem[],
      selectedMapSetId: "satellite",
      minimumZoom: 2,
      maximumZoom: 4,
      currentZoom: 3,
      documentationLanguage: "en",
      documentationPages: [
        { id: "tile-cache", title: "Tile Cache" },
        { id: "home", title: "Introduction" },
      ],
      toolsEnabled: false,
      layersEnabled: false,
      comparisonOptionsAvailable: true,
      comparisonActive: true,
      comparisonCanActivate: true,
      cachedTilesOnly: true,
      showTitleBar: false,
      showMapSelector: true,
      mapSelectorAvailable: true,
      showCoordinates: true,
      showAttribution: false,
      showTileGrid: true,
      tileGridAvailable: true,
    });

    expect(items.map(({ label }) => label)).toEqual([
      "Goto",
      "Map Set",
      "Zoom",
      "Tools",
      "Options",
    ]);
    expect(items[1]?.children?.[0]?.children).toMatchObject([
      {
        id: `${mapContextMenuIds.mapSetPrefix}satellite`,
        label: "Satellite",
        selected: true,
      },
      {
        id: `${mapContextMenuIds.mapSetPrefix}streets`,
        label: "Streets",
        selected: false,
      },
    ]);
    expect(items[1]?.children?.[1]).toMatchObject({
      id: `${mapContextMenuIds.mapSetPrefix}root`,
      label: "Root Map",
      selected: false,
    });
    expect(items[1]?.children?.[1]?.children).toBeUndefined();
    expect(items[2]?.children).toMatchObject([
      { id: `${mapContextMenuIds.zoomPrefix}2`, label: "2", selected: false },
      { id: `${mapContextMenuIds.zoomPrefix}3`, label: "3", selected: true },
      { id: `${mapContextMenuIds.zoomPrefix}4`, label: "4", selected: false },
    ]);
    expect(items[0]?.children?.map(({ id }) => id)).toEqual([
      mapContextMenuIds.mapSets,
      mapContextMenuIds.tileCache,
      mapContextMenuIds.coverage,
      "goto-documentation",
    ]);
    expect(items[0]?.children?.[2]).toMatchObject({
      id: mapContextMenuIds.coverage,
      label: "Coverage",
      icon: "mdi-grid",
    });
    expect(items[0]?.children?.[3]?.children).toMatchObject([
      {
        id: `${mapContextMenuIds.documentationPrefix}home`,
        label: "Introduction",
      },
      {
        id: `${mapContextMenuIds.documentationPrefix}tile-cache`,
        label: "Tile Cache",
      },
    ]);
    expect(items[3]?.children).toMatchObject([
      { id: mapContextMenuIds.gotoCoordinates, disabled: true },
      { id: mapContextMenuIds.tileCalculator, disabled: true },
      { id: mapContextMenuIds.layers, disabled: true },
      { id: mapContextMenuIds.compareMaps, disabled: false },
      { id: mapContextMenuIds.displayOptions },
    ]);
    expect(items[4]?.children).toMatchObject([
      {
        id: mapContextMenuIds.compareMapsEnabled,
        checked: true,
        disabled: false,
      },
      { id: mapContextMenuIds.cachedTilesOnly, checked: true },
      { id: mapContextMenuIds.showTitleBar, checked: false },
      {
        id: mapContextMenuIds.showMapSelector,
        checked: true,
        disabled: false,
      },
      { id: mapContextMenuIds.showCoordinates, checked: true },
      { id: mapContextMenuIds.showAttribution, checked: false },
      {
        id: mapContextMenuIds.showTileGrid,
        checked: true,
        disabled: false,
      },
    ]);
  });

  it("disables the map selector option when it is unavailable", () => {
    const items = createMapContextMenuItems({
      mapSets: [],
      selectedMapSetId: null,
      minimumZoom: null,
      maximumZoom: null,
      currentZoom: null,
      documentationLanguage: "en",
      documentationPages: [],
      toolsEnabled: false,
      layersEnabled: false,
      comparisonOptionsAvailable: false,
      comparisonActive: false,
      comparisonCanActivate: false,
      cachedTilesOnly: false,
      showTitleBar: true,
      showMapSelector: true,
      mapSelectorAvailable: false,
      showCoordinates: true,
      showAttribution: true,
      showTileGrid: false,
      tileGridAvailable: false,
    });

    expect(items[4]?.children).toContainEqual(
      expect.objectContaining({
        id: mapContextMenuIds.showMapSelector,
        disabled: true,
      }),
    );
    expect(items[3]?.children).toContainEqual(
      expect.objectContaining({
        id: mapContextMenuIds.compareMaps,
        disabled: true,
      }),
    );
    expect(items[4]?.children).toContainEqual(
      expect.objectContaining({
        id: mapContextMenuIds.compareMapsEnabled,
        checked: false,
        disabled: true,
      }),
    );
  });
});
