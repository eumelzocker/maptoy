import { describe, expect, it } from "vitest";
import { loadConfig, normalizeBasePath } from "./index.js";

describe("normalizeBasePath", () => {
  it("normalizes root and nested paths", () => {
    expect(normalizeBasePath("")).toBe("/");
    expect(normalizeBasePath("tools/maptoy/")).toBe("/tools/maptoy");
  });

  it("rejects paths that are unsafe in an HTML base element", () => {
    expect(() => normalizeBasePath('/maptoy" onclick="alert(1)')).toThrow();
    expect(() => normalizeBasePath("/../maptoy")).toThrow();
  });
});

describe("loadConfig", () => {
  it("validates the HTTP port", () => {
    expect(() => loadConfig({ MAPTOY_PORT: "70000" })).toThrow();
  });
});
