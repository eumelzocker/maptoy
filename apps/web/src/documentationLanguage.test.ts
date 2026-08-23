import { afterEach, describe, expect, it } from "vitest";
import {
  loadDocumentationLanguage,
  saveDocumentationLanguage,
} from "./documentationLanguage.js";
import { getItem } from "./localStorage.js";

const knownLanguageCodes = ["en", "de", "th"];

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

describe("documentation language persistence", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("falls back when no language was saved yet", () => {
    expect(loadDocumentationLanguage(knownLanguageCodes, "en")).toBe("en");
  });

  it("restores a previously saved, still-known language", () => {
    globalThis.localStorage = memoryStorage();
    saveDocumentationLanguage("de");
    expect(loadDocumentationLanguage(knownLanguageCodes, "en")).toBe("de");
  });

  it("falls back when the saved language is no longer offered", () => {
    globalThis.localStorage = memoryStorage();
    saveDocumentationLanguage("fr");
    expect(loadDocumentationLanguage(knownLanguageCodes, "en")).toBe("en");
  });

  it("stores under the maptoy-prefixed key", () => {
    globalThis.localStorage = memoryStorage();
    saveDocumentationLanguage("th");
    expect(getItem("maptoy:docs-language")).toBe("th");
  });
});
