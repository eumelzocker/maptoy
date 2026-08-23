import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUiPreferencesStore } from "./uiPreferences.js";

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

describe("UI preferences store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("defaults to showing the title bar when no localStorage global is available", () => {
    const store = useUiPreferencesStore();
    expect(store.showTitleBar).toBe(true);
  });

  it("persists and reflects a change", () => {
    const store = useUiPreferencesStore();
    store.setShowTitleBar(false);
    expect(store.showTitleBar).toBe(false);
  });

  it("stays usable when localStorage rejects reads and writes", () => {
    globalThis.localStorage = throwingLocalStorage();
    const store = useUiPreferencesStore();
    expect(store.showTitleBar).toBe(true);
    expect(() => store.setShowTitleBar(false)).not.toThrow();
    expect(store.showTitleBar).toBe(false);
  });
});
