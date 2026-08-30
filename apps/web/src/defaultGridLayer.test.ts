import type { Layer } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRID_LAYER_NAME,
  findDefaultGridLayer,
} from "./defaultGridLayer.js";

function layer(overrides: Partial<Layer>): Layer {
  return {
    id: "layer-id",
    name: DEFAULT_GRID_LAYER_NAME,
    pluginId: "tile-grid-layer",
    pluginVersion: "0.0.0",
    schemaVersion: 2,
    configuration: {},
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
    ...overrides,
  };
}

describe("Default Grid layer", () => {
  it("finds only the exact Tile Grid layer name", () => {
    const expected = layer({ id: "expected" });
    expect(
      findDefaultGridLayer([
        layer({ id: "wrong-name", name: "Other Grid" }),
        layer({ id: "wrong-plugin", pluginId: "track-layer" }),
        expected,
      ]),
    ).toBe(expected);
  });

  it("returns null when no Default Grid exists", () => {
    expect(findDefaultGridLayer([])).toBeNull();
  });
});
