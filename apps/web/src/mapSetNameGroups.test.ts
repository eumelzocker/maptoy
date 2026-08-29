import { describe, expect, it } from "vitest";
import {
  createMapSetNameEntries,
  splitMapSetName,
} from "./mapSetNameGroups.js";

describe("Map Set name groups", () => {
  it("sorts up to eight root Map Sets below named folders", () => {
    const entries = createMapSetNameEntries([
      { id: "1", name: "MapBox/Dark-v11/webp" },
      { id: "2", name: "MapBox/NaviDay-v1/webp" },
      { id: "3", name: "MapTiler/Backdrop-v4" },
      { id: "4", name: "Atlas" },
      { id: "5", name: "OpenTopoMap" },
    ]);

    expect(entries.map(({ label }) => label)).toEqual([
      "MapBox",
      "MapTiler",
      "Atlas",
      "OpenTopoMap",
    ]);
    expect(entries.map(({ kind }) => kind)).toEqual([
      "folder",
      "folder",
      "map-set",
      "map-set",
    ]);
    const mapBox = entries[0];
    expect(mapBox?.kind).toBe("folder");
    expect(
      mapBox?.kind === "folder" ? mapBox.items.map(({ label }) => label) : [],
    ).toEqual(["Dark-v11/webp", "NaviDay-v1/webp"]);
  });

  it("does not treat an empty first or second segment as a folder", () => {
    const entries = createMapSetNameEntries([
      { id: "1", name: "/OSM" },
      { id: "2", name: "MapBox/" },
    ]);

    expect(entries).toMatchObject([
      { kind: "map-set", label: "/OSM" },
      { kind: "map-set", label: "MapBox/" },
    ]);
  });

  it("collects more than eight root Map Sets in a sorted virtual folder", () => {
    const entries = createMapSetNameEntries([
      { id: "folder", name: "Provider/Map" },
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `root-${index}`,
        name: `Root ${String(index + 1).padStart(2, "0")}`,
      })),
    ]);

    expect(entries.map(({ label }) => label)).toEqual([
      "Other Maps",
      "Provider",
    ]);
    expect(entries[0]).toMatchObject({
      kind: "folder",
      label: "Other Maps",
      virtual: true,
    });
    expect(
      entries[0]?.kind === "folder"
        ? entries[0].items.map(({ label }) => label)
        : [],
    ).toEqual([
      "Root 01",
      "Root 02",
      "Root 03",
      "Root 04",
      "Root 05",
      "Root 06",
      "Root 07",
      "Root 08",
      "Root 09",
    ]);
  });

  it("keeps exactly eight root Map Sets at the top level", () => {
    const entries = createMapSetNameEntries(
      Array.from({ length: 8 }, (_, index) => ({
        id: `root-${index}`,
        name: `Root ${index + 1}`,
      })),
    );

    expect(entries).toHaveLength(8);
    expect(entries.every(({ kind }) => kind === "map-set")).toBe(true);
  });

  it("splits only the first hierarchy separator", () => {
    expect(splitMapSetName("MapBox/Dark-v11/webp")).toEqual({
      group: "MapBox",
      label: "Dark-v11/webp",
    });
    expect(splitMapSetName("OSM")).toEqual({ group: null, label: "OSM" });
  });
});
