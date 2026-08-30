import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../database.js";
import { layerPluginRegistry } from "../registries.js";
import { LayerRepository } from "./repository.js";
import { LayerService } from "./service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Layer service", () => {
  it("creates a data-free Tile Grid layer through the generic Layer service", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-layer-test-"));
    temporaryDirectories.push(directory);
    const database = await openDatabase(path.join(directory, "maptoy.sqlite"));
    const repository = new LayerRepository(database.sqlite);
    const layers = new LayerService(repository, layerPluginRegistry);

    await expect(
      layers.create({
        name: "Tile Grid",
        pluginId: "tile-grid-layer",
        configuration: {},
        data: {},
        visible: true,
        displayOrder: 0,
        opacity: 1,
        minimumZoom: null,
        maximumZoom: null,
      }),
    ).resolves.toMatchObject({
      pluginId: "tile-grid-layer",
      configuration: {
        showGrid: true,
        showLabels: true,
        showScale: true,
        scaleWidthPercent: 75,
      },
      data: {},
      status: "ready",
    });
    database.close();
  });

  it("migrates a Tile Grid pixel width to a Tile percentage", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-layer-test-"));
    temporaryDirectories.push(directory);
    const database = await openDatabase(path.join(directory, "maptoy.sqlite"));
    const repository = new LayerRepository(database.sqlite);
    repository.insert({
      id: "legacy-tile-grid",
      name: "Legacy Tile Grid",
      pluginId: "tile-grid-layer",
      pluginVersion: "0.2.2",
      schemaVersion: 1,
      configuration: {
        showGrid: true,
        showLabels: true,
        showScale: true,
        scaleMaximumWidth: 192,
      },
      data: {},
      visible: true,
      displayOrder: 0,
      opacity: 1,
      minimumZoom: null,
      maximumZoom: null,
      status: "ready",
      diagnostic: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    });

    const layers = new LayerService(repository, layerPluginRegistry);
    await layers.initialize();

    expect(layers.get("legacy-tile-grid")).toMatchObject({
      schemaVersion: 2,
      configuration: {
        showGrid: true,
        showLabels: true,
        showScale: true,
        scaleWidthPercent: 75,
      },
      status: "ready",
    });
    database.close();
  });

  it("preserves effective Track opacity while migrating schema 1", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-layer-test-"));
    temporaryDirectories.push(directory);
    const database = await openDatabase(path.join(directory, "maptoy.sqlite"));
    const repository = new LayerRepository(database.sqlite);
    repository.insert({
      id: "legacy-track",
      name: "Legacy Track",
      pluginId: "track-layer",
      pluginVersion: "0.2.0",
      schemaVersion: 1,
      configuration: {
        lineColor: "#123456",
        lineWidth: 5,
        lineOpacity: 0.5,
      },
      data: { features: [] },
      visible: true,
      displayOrder: 0,
      opacity: 0.8,
      minimumZoom: null,
      maximumZoom: null,
      status: "ready",
      diagnostic: null,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });

    const layers = new LayerService(repository, layerPluginRegistry);
    await layers.initialize();

    expect(layers.get("legacy-track")).toMatchObject({
      schemaVersion: 2,
      configuration: { lineColor: "#123456", lineWidth: 5 },
      opacity: 0.4,
      status: "ready",
    });
    expect(
      database.sqlite
        .prepare(
          "SELECT COUNT(*) AS count, opacity FROM layer_instance_versions WHERE layer_id = ?",
        )
        .get("legacy-track"),
    ).toEqual({ count: 1, opacity: 0.8 });
    database.close();
  });
});
