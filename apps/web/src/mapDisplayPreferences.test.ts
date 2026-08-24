import { describe, expect, it } from "vitest";
import {
  loadShowAttribution,
  loadShowCoordinates,
  loadShowMapSelector,
  loadShowTitleBar,
  saveShowAttribution,
  saveShowCoordinates,
  saveShowMapSelector,
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
  });

  it("round-trips a saved preference", () => {
    const storage = memoryStorage();
    saveShowCoordinates(false, storage);
    saveShowAttribution(false, storage);
    saveShowTitleBar(false, storage);
    saveShowMapSelector(false, storage);
    expect(loadShowCoordinates(storage)).toBe(false);
    expect(loadShowAttribution(storage)).toBe(false);
    expect(loadShowTitleBar(storage)).toBe(false);
    expect(loadShowMapSelector(storage)).toBe(false);
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
  });

  it("keeps the preferences independent", () => {
    const storage = memoryStorage();
    saveShowCoordinates(false, storage);
    expect(loadShowCoordinates(storage)).toBe(false);
    expect(loadShowAttribution(storage)).toBe(true);
    expect(loadShowTitleBar(storage)).toBe(true);
    expect(loadShowMapSelector(storage)).toBe(true);
  });
});
