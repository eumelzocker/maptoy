import { afterEach, describe, expect, it } from "vitest";
import {
  availableLocalStorage,
  getItem,
  removeItem,
  setItem,
} from "./localStorage.js";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    length: 0,
    clear: () => values.clear(),
    key: () => null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => {
      values.delete(key);
    },
  } as Storage;
}

function throwingStorage(): Storage {
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

describe("storage access with an explicit storage", () => {
  it("reads and writes through a working storage", () => {
    const storage = memoryStorage();
    setItem("key", "value", storage);
    expect(getItem("key", storage)).toBe("value");
    removeItem("key", storage);
    expect(getItem("key", storage)).toBeNull();
  });

  it("does not throw when the storage rejects reads, writes, or removals", () => {
    const storage = throwingStorage();
    expect(getItem("key", storage)).toBeNull();
    expect(() => setItem("key", "value", storage)).not.toThrow();
    expect(() => removeItem("key", storage)).not.toThrow();
  });
});

describe("storage access against the global localStorage", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("returns null when no localStorage global exists", () => {
    expect(typeof globalThis.localStorage).toBe("undefined");
    expect(getItem("maptoy:missing")).toBeNull();
  });

  it("does not throw when browser policy blocks access to the Storage property", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Storage access denied", "SecurityError");
      },
    });

    expect(availableLocalStorage()).toBeNull();
    expect(getItem("key")).toBeNull();
    expect(() => setItem("key", "value")).not.toThrow();
    expect(() => removeItem("key")).not.toThrow();
  });
});
