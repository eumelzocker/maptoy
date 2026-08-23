import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMapSetsStore } from "./mapSets.js";

function throwingLocalStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    key: () => null,
    getItem: () => {
      throw new Error("Storage disabled");
    },
    setItem: () => {
      throw new Error("Storage disabled");
    },
    removeItem: () => {
      throw new Error("Storage disabled");
    },
  } as Storage;
}

describe("map sets store selection persistence", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("stays usable when no localStorage global is available", () => {
    const store = useMapSetsStore();
    expect(store.selectedId).toBeNull();
    expect(() => store.select("map-set-a")).not.toThrow();
    expect(store.selectedId).toBe("map-set-a");
  });

  it("stays usable when localStorage rejects reads and writes", () => {
    globalThis.localStorage = throwingLocalStorage();
    const store = useMapSetsStore();
    expect(store.selectedId).toBeNull();
    expect(() => store.select("map-set-a")).not.toThrow();
    expect(store.selectedId).toBe("map-set-a");
  });
});
