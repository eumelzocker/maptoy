import path from "node:path";
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

  it("derives the database path and validates provider safety options", () => {
    const config = loadConfig({ MAPTOY_DATA_DIR: "test-data" });
    expect(config.databasePath).toBe(
      path.join(config.dataDirectory, "maptoy.sqlite"),
    );
    expect(
      loadConfig({ MAPTOY_ALLOW_PRIVATE_TILE_HOSTS: "true" })
        .allowPrivateTileHosts,
    ).toBe(true);
    expect(() =>
      loadConfig({ MAPTOY_ALLOW_PRIVATE_TILE_HOSTS: "sometimes" }),
    ).toThrow("MAPTOY_ALLOW_PRIVATE_TILE_HOSTS");
    expect(() => loadConfig({ MAPTOY_MAX_TILE_BYTES: "0" })).toThrow(
      "MAPTOY_MAX_TILE_BYTES",
    );
  });
});
