import { describe, expect, it } from "vitest";
import {
  loadCollapsedLayerHierarchy,
  loadExpandedLayerConfigurations,
  saveCollapsedLayerHierarchy,
  saveExpandedLayerConfigurations,
} from "./layerPanelPreferences.js";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("Layer panel preferences", () => {
  it("defaults every Layer configuration to collapsed", () => {
    const storage = memoryStorage();
    expect(loadExpandedLayerConfigurations(storage)).toEqual([]);
    expect(loadCollapsedLayerHierarchy(storage)).toEqual([]);
  });

  it("round-trips collapsed hierarchy nodes", () => {
    const storage = memoryStorage();
    saveCollapsedLayerHierarchy(
      ["category:tracks", "folder:tracks:Trips"],
      storage,
    );
    expect(loadCollapsedLayerHierarchy(storage)).toEqual([
      "category:tracks",
      "folder:tracks:Trips",
    ]);
  });

  it("migrates the earlier category-only preference", () => {
    expect(
      loadCollapsedLayerHierarchy({
        getItem: (key) =>
          key === "maptoy:collapsed-layer-categories" ? '["tracks"]' : null,
        setItem: () => undefined,
      }),
    ).toEqual(["category:tracks"]);
  });

  it("round-trips expanded Layer IDs without duplicates", () => {
    const storage = memoryStorage();
    saveExpandedLayerConfigurations(["track", "images", "track"], storage);
    expect(loadExpandedLayerConfigurations(storage)).toEqual([
      "track",
      "images",
    ]);
  });

  it("ignores malformed or non-string stored entries", () => {
    expect(
      loadExpandedLayerConfigurations({
        getItem: () => "not-json",
        setItem: () => undefined,
      }),
    ).toEqual([]);
    expect(
      loadExpandedLayerConfigurations({
        getItem: () => '["track", 42, null]',
        setItem: () => undefined,
      }),
    ).toEqual(["track"]);
  });
});
