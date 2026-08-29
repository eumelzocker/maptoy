import type { MapSetListItem } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import { createMapSetMenuItems } from "./mapSetMenuItems.js";

describe("Map Set menu items", () => {
  it("creates folder submenus and direct items for a small root set", () => {
    const mapSets = [
      { id: "dark", name: "MapBox/Dark-v11/webp" },
      { id: "sat", name: "MapBox/Sat-v9/webp" },
      { id: "base", name: "MapTiler/Base-v4" },
      { id: "osm", name: "OSM" },
    ] as MapSetListItem[];

    const items = createMapSetMenuItems(mapSets, "sat");

    expect(items.map(({ label }) => label)).toEqual([
      "MapBox",
      "MapTiler",
      "OSM",
    ]);
    expect(items[0]?.children).toMatchObject([
      { id: "dark", label: "Dark-v11/webp", selected: false },
      { id: "sat", label: "Sat-v9/webp", selected: true },
    ]);
    expect(items[0]?.selected).toBe(true);
    expect(items[1]?.selected).toBe(false);
    expect(items[2]).toMatchObject({
      id: "osm",
      label: "OSM",
      selected: false,
    });
    expect(items[2]?.children).toBeUndefined();
  });

  it("creates the Other Maps submenu for more than eight root Map Sets", () => {
    const mapSets = Array.from({ length: 9 }, (_, index) => ({
      id: `root-${index}`,
      name: `Root ${String(index + 1).padStart(2, "0")}`,
    })) as MapSetListItem[];

    const items = createMapSetMenuItems(mapSets, "root-8");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "ungrouped",
      label: "Other Maps",
      icon: "mdi-format-list-bulleted",
      selected: true,
    });
    expect(items[0]?.children).toHaveLength(9);
  });
});
