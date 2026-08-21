import { describe, expect, it } from "vitest";
import { loadConfig } from "./index.js";

describe("loadConfig", () => {
  it("uses the project-specific default HTTP port", () => {
    expect(loadConfig({}).port).toBe(4004);
  });

  it("validates the HTTP port", () => {
    expect(() => loadConfig({ MAPTOY_PORT: "70000" })).toThrow();
  });

  it("validates the log level", () => {
    expect(() => loadConfig({ MAPTOY_LOG_LEVEL: "verbose" })).toThrow();
    expect(loadConfig({ MAPTOY_LOG_LEVEL: "debug" })).toMatchObject({
      logLevel: "debug",
    });
  });
});
