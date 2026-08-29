import { describe, expect, it } from "vitest";
import {
  applicationViewForPath,
  applicationViews,
  isApplicationViewActive,
} from "./applicationViews.js";

describe("application views", () => {
  it("keeps view IDs and paths unique", () => {
    expect(new Set(applicationViews.map(({ id }) => id)).size).toBe(
      applicationViews.length,
    );
    expect(new Set(applicationViews.map(({ path }) => path)).size).toBe(
      applicationViews.length,
    );
  });

  it("matches root exactly and nested view routes by path segment", () => {
    const map = applicationViews.find(({ id }) => id === "map");
    const mapSets = applicationViews.find(({ id }) => id === "map-sets");
    expect(map).toBeDefined();
    expect(mapSets).toBeDefined();
    if (map === undefined || mapSets === undefined) {
      throw new Error("Expected application views are missing");
    }
    expect(isApplicationViewActive(map, "/")).toBe(true);
    expect(isApplicationViewActive(map, "/cache")).toBe(false);
    expect(isApplicationViewActive(mapSets, "/map-sets/example")).toBe(true);
    expect(isApplicationViewActive(mapSets, "/map-sets-other")).toBe(false);
  });

  it("selects the view for detail and documentation routes", () => {
    expect(applicationViewForPath("/coverage/example")?.id).toBe("coverage");
    expect(applicationViewForPath("/docs/de/getting-started")?.id).toBe("docs");
    expect(applicationViewForPath("/unknown")).toBeUndefined();
  });
});
