import type { MapSetListItem } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import { createMapSetMenuItems } from "./mapSetMenuItems.js";

describe("Map Set menu items", () => {
  it("creates one submenu per first-level name group", () => {
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
      "Other Map Sets",
    ]);
    expect(items[0]?.children).toMatchObject([
      { id: "dark", label: "Dark-v11/webp", selected: false },
      { id: "sat", label: "Sat-v9/webp", selected: true },
    ]);
    expect(items[0]?.selected).toBe(true);
    expect(items[1]?.selected).toBe(false);
    expect(items[2]?.children).toMatchObject([
      { id: "osm", label: "OSM", selected: false },
    ]);
  });
});
