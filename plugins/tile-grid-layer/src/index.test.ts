import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  defaultTileGridLayerConfiguration,
  tileGridLayerPlugin,
} from "./index.js";

describe("Tile Grid layer plugin", () => {
  it("satisfies the plugin contract without assets or server hooks", async () => {
    const publishLayer = vi.fn();
    await expect(
      exerciseLayerPluginContract(tileGridLayerPlugin, {
        configuration: {},
        data: {},
        migration: {
          fromSchemaVersion: 1,
          configuration: { scaleMaximumWidth: 128 },
          value: {},
        },
        frontendContext: {
          instanceId: "tile-grid",
          publishLayer,
          clearLayer: vi.fn(),
          resolveAssetUrl: vi.fn(),
        },
      }),
    ).resolves.toBeUndefined();
    expect(publishLayer).toHaveBeenLastCalledWith({
      type: "composite",
      data: {
        kind: "composite",
        layers: [
          {
            kind: "xyz-tile-grid",
            lineColor: defaultTileGridLayerConfiguration.lineColor,
            textColor: defaultTileGridLayerConfiguration.textColor,
            backgroundColor: defaultTileGridLayerConfiguration.backgroundColor,
            showGrid: true,
            showLabels: true,
            showScale: true,
            scaleWidthPercent: 75,
          },
        ],
      },
    });
  });

  it("migrates the former pixel width to a percentage of a 256 px Tile", async () => {
    const migration = tileGridLayerPlugin.shared.migrations[0];
    const migrated = await migration?.migrateLayer?.({
      configuration: {
        showGrid: true,
        scaleMaximumWidth: 192,
      },
      data: {},
      opacity: 0.8,
    });

    expect(migrated).toEqual({
      configuration: {
        showGrid: true,
        scaleWidthPercent: 75,
      },
      data: {},
      opacity: 0.8,
    });
  });

  it("publishes no decoration when grid, labels, and scales are hidden", async () => {
    const publishLayer = vi.fn();
    const handle = await tileGridLayerPlugin.frontend.mount(
      {
        instanceId: "tile-grid",
        publishLayer,
        clearLayer: vi.fn(),
        resolveAssetUrl: vi.fn(),
      },
      {
        configuration: {
          showGrid: false,
          showLabels: false,
          showScale: false,
        },
        data: {},
        assets: [],
        opacity: 1,
        visible: true,
      },
    );
    expect(publishLayer).toHaveBeenCalledWith({
      type: "composite",
      data: { kind: "composite", layers: [] },
    });
    await handle.destroy();
  });

  it("keeps per-Tile scales independent from grid lines and labels", async () => {
    const publishLayer = vi.fn();
    const handle = await tileGridLayerPlugin.frontend.mount(
      {
        instanceId: "tile-grid",
        publishLayer,
        clearLayer: vi.fn(),
        resolveAssetUrl: vi.fn(),
      },
      {
        configuration: {
          showGrid: false,
          showLabels: false,
          showScale: true,
        },
        data: {},
        assets: [],
        opacity: 1,
        visible: true,
      },
    );
    expect(publishLayer).toHaveBeenCalledWith({
      type: "composite",
      data: {
        kind: "composite",
        layers: [
          expect.objectContaining({
            kind: "xyz-tile-grid",
            showGrid: false,
            showLabels: false,
            showScale: true,
          }),
        ],
      },
    });
    await handle.destroy();
  });
});
