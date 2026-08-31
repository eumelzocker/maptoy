import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./index.js";

describe("loadConfig", () => {
  it("uses the project-specific default HTTP port", () => {
    expect(loadConfig({}).server.port).toBe(4004);
  });

  it("validates the HTTP port", () => {
    expect(() => loadConfig({ MAPTOY_SERVER_PORT: "70000" })).toThrow();
  });

  it("validates the log level", () => {
    expect(() => loadConfig({ MAPTOY_LOGGING_LEVEL: "verbose" })).toThrow();
    expect(loadConfig({ MAPTOY_LOGGING_LEVEL: "debug" })).toMatchObject({
      logging: { level: "debug" },
    });
  });

  it("derives the database path and validates provider safety options", () => {
    const config = loadConfig({ MAPTOY_STORAGE_DATA_DIR: "test-data" });
    expect(config.storage.databasePath).toBe(
      path.join(config.storage.dataDirectory, "maptoy.sqlite"),
    );
    expect(
      loadConfig({ MAPTOY_TILES_ALLOW_PRIVATE_HOSTS: "true" }).tiles
        .allowPrivateHosts,
    ).toBe(true);
    expect(() =>
      loadConfig({ MAPTOY_TILES_ALLOW_PRIVATE_HOSTS: "sometimes" }),
    ).toThrow("MAPTOY_TILES_ALLOW_PRIVATE_HOSTS");
    expect(() => loadConfig({ MAPTOY_TILES_MAX_BYTES: "0" })).toThrow(
      "MAPTOY_TILES_MAX_BYTES",
    );
  });

  it("derives independently configurable traffic log directories", () => {
    const config = loadConfig({
      MAPTOY_STORAGE_DATA_DIR: "test-data",
      MAPTOY_LOGGING_API_TRAFFIC_DIR:
        "$" + "{MAPTOY_STORAGE_DATA_DIR}/custom-api",
      MAPTOY_LOGGING_PROVIDER_TRAFFIC_DIR: "outside/provider",
      MAPTOY_LOGGING_TRAFFIC_MAX_BYTES: "2048",
      MAPTOY_LOGGING_TRAFFIC_MAX_FILES: "3",
    });

    expect(config.logging.apiTrafficDirectory).toBe(
      path.join(config.storage.dataDirectory, "custom-api"),
    );
    expect(config.logging.providerTrafficDirectory).toBe(
      path.resolve("outside/provider"),
    );
    expect(config.logging.trafficMaximumBytes).toBe(2048);
    expect(config.logging.trafficMaximumFiles).toBe(3);
    expect(() => loadConfig({ MAPTOY_LOGGING_TRAFFIC_MAX_FILES: "0" })).toThrow(
      "MAPTOY_LOGGING_TRAFFIC_MAX_FILES",
    );
  });

  it("resolves the read-only Photo directory and validates Photo limits", () => {
    const config = loadConfig({
      MAPTOY_PHOTOS_DIR: "photos",
      MAPTOY_PHOTOS_MAX_FILE_BYTES: "2048",
      MAPTOY_PHOTOS_MAX_DECODED_PIXELS: "4096",
      MAPTOY_PHOTOS_PREVIEW_MAX_EDGE: "320",
      MAPTOY_PHOTOS_SCAN_BATCH_SIZE: "25",
      MAPTOY_PHOTOS_SCAN_CONCURRENCY: "1",
      MAPTOY_PHOTOS_SCAN_MAX_FILES: "500",
    });
    expect(config.photos.directory).toBe(path.resolve("photos"));
    expect(config.photos).toMatchObject({
      maximumFileBytes: 2048,
      maximumDecodedPixels: 4096,
      previewMaximumEdge: 320,
      scanBatchSize: 25,
      scanConcurrency: 1,
      scanMaximumFiles: 500,
    });
    expect(loadConfig({ MAPTOY_PHOTOS_DIR: "" }).photos.directory).toBeNull();
    expect(() => loadConfig({ MAPTOY_PHOTOS_SCAN_CONCURRENCY: "17" })).toThrow(
      "must not exceed 16",
    );
  });

  it("does not accept legacy environment aliases", () => {
    const config = loadConfig({
      MAPTOY_HOST: "127.0.0.1",
      MAPTOY_PORT: "1234",
      MAPTOY_DATA_DIR: "/legacy-data",
      MAPTOY_IMAGE_ROOTS_JSON: '{"legacy":"/photos"}',
      MAPTOY_MAX_IMAGE_BYTES: "2048",
    });

    expect(config.server).toEqual({
      host: "0.0.0.0",
      port: 4004,
    });
    expect(config.storage.dataDirectory).not.toBe("/legacy-data");
    expect(config.photos.directory).toBeNull();
    expect(config.photos.maximumFileBytes).toBe(100 * 1024 * 1024);
  });
});
