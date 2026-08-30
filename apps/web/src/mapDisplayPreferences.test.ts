import { describe, expect, it } from "vitest";
import {
  loadCachedTilesOnly,
  loadCoordinateFormat,
  loadShowAttribution,
  loadShowCoordinates,
  loadShowMapSelector,
  loadShowTileGrid,
  loadShowTitleBar,
  saveCachedTilesOnly,
  saveCoordinateFormat,
  saveShowAttribution,
  saveShowCoordinates,
  saveShowMapSelector,
  saveShowTileGrid,
  saveShowTitleBar,
} from "./mapDisplayPreferences.js";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("Map display preferences", () => {
  it("defaults to showing all map display elements when unset", () => {
    const storage = memoryStorage();
    expect(loadShowCoordinates(storage)).toBe(true);
    expect(loadShowAttribution(storage)).toBe(true);
    expect(loadShowTitleBar(storage)).toBe(true);
    expect(loadShowMapSelector(storage)).toBe(true);
    expect(loadCachedTilesOnly(storage)).toBe(false);
    expect(loadShowTileGrid(storage)).toBe(false);
    expect(loadCoordinateFormat(storage)).toBe("dd");
  });

  it("round-trips a saved preference", () => {
    const storage = memoryStorage();
    saveShowCoordinates(false, storage);
    saveShowAttribution(false, storage);
    saveShowTitleBar(false, storage);
    saveShowMapSelector(false, storage);
    saveCachedTilesOnly(true, storage);
    saveShowTileGrid(true, storage);
    saveCoordinateFormat("dms", storage);
    expect(loadShowCoordinates(storage)).toBe(false);
    expect(loadShowAttribution(storage)).toBe(false);
    expect(loadShowTitleBar(storage)).toBe(false);
    expect(loadShowMapSelector(storage)).toBe(false);
    expect(loadCachedTilesOnly(storage)).toBe(true);
    expect(loadShowTileGrid(storage)).toBe(true);
    expect(loadCoordinateFormat(storage)).toBe("dms");
  });

  it("falls back to true for a malformed stored value", () => {
    const storage = {
      getItem: () => "not-a-boolean",
      setItem: () => undefined,
    };
    expect(loadShowCoordinates(storage)).toBe(true);
    expect(loadShowAttribution(storage)).toBe(true);
    expect(loadShowTitleBar(storage)).toBe(true);
    expect(loadShowMapSelector(storage)).toBe(true);
    expect(loadCachedTilesOnly(storage)).toBe(false);
    expect(loadShowTileGrid(storage)).toBe(false);
    expect(loadCoordinateFormat(storage)).toBe("dd");
  });

  it("keeps the preferences independent", () => {
    const storage = memoryStorage();
    saveShowCoordinates(false, storage);
    expect(loadShowCoordinates(storage)).toBe(false);
    expect(loadShowAttribution(storage)).toBe(true);
    expect(loadShowTitleBar(storage)).toBe(true);
    expect(loadShowMapSelector(storage)).toBe(true);
    expect(loadCachedTilesOnly(storage)).toBe(false);
    expect(loadShowTileGrid(storage)).toBe(false);
  });
});
