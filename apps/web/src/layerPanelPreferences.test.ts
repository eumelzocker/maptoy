import { describe, expect, it } from "vitest";
import {
  loadCollapsedLayerHierarchy,
  loadSelectedLayerId,
  saveCollapsedLayerHierarchy,
  saveSelectedLayerId,
} from "./layerPanelPreferences.js";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("Layer panel preferences", () => {
  it("defaults to no selected Layer and an expanded hierarchy", () => {
    const storage = memoryStorage();
    expect(loadSelectedLayerId(storage)).toBeNull();
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

  it("round-trips the selected Layer ID", () => {
    const storage = memoryStorage();
    saveSelectedLayerId("track", storage);
    expect(loadSelectedLayerId(storage)).toBe("track");
    saveSelectedLayerId(null, storage);
    expect(loadSelectedLayerId(storage)).toBeNull();
  });

  it("migrates the first formerly expanded Layer", () => {
    expect(
      loadSelectedLayerId({
        getItem: (key) =>
          key === "maptoy:expanded-layer-configurations"
            ? '["track", "photos"]'
            : null,
        setItem: () => undefined,
      }),
    ).toBe("track");
    expect(
      loadSelectedLayerId({
        getItem: (key) =>
          key === "maptoy:expanded-layer-configurations" ? "not-json" : null,
        setItem: () => undefined,
      }),
    ).toBeNull();
  });
});
