import { describe, expect, it } from "vitest";
import {
  groupMapSetsByFirstNameSegment,
  splitMapSetName,
} from "./mapSetNameGroups.js";

describe("Map Set name groups", () => {
  it("groups the first name segment and keeps the remaining path as the item label", () => {
    const groups = groupMapSetsByFirstNameSegment([
      { id: "1", name: "MapBox/Dark-v11/webp" },
      { id: "2", name: "MapBox/NaviDay-v1/webp" },
      { id: "3", name: "MapTiler/Backdrop-v4" },
      { id: "4", name: "OSM" },
      { id: "5", name: "OpenTopoMap" },
    ]);

    expect(groups.map(({ label }) => label)).toEqual([
      "MapBox",
      "MapTiler",
      "Other Map Sets",
    ]);
    expect(groups[0]?.items.map(({ label }) => label)).toEqual([
      "Dark-v11/webp",
      "NaviDay-v1/webp",
    ]);
    expect(groups[1]?.items.map(({ label }) => label)).toEqual(["Backdrop-v4"]);
    expect(groups[2]?.items.map(({ label }) => label)).toEqual([
      "OSM",
      "OpenTopoMap",
    ]);
  });

  it("does not treat an empty first or second segment as a group", () => {
    const groups = groupMapSetsByFirstNameSegment([
      { id: "1", name: "/OSM" },
      { id: "2", name: "MapBox/" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "Other Map Sets",
      ungrouped: true,
    });
    expect(groups[0]?.items.map(({ label }) => label)).toEqual([
      "/OSM",
      "MapBox/",
    ]);
  });

  it("splits only the first hierarchy separator", () => {
    expect(splitMapSetName("MapBox/Dark-v11/webp")).toEqual({
      group: "MapBox",
      label: "Dark-v11/webp",
    });
    expect(splitMapSetName("OSM")).toEqual({ group: null, label: "OSM" });
  });
});
