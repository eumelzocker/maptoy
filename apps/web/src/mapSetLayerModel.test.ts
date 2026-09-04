import { describe, expect, it } from "vitest";
import { resolvedMapSetLayerData } from "./mapSetLayerModel.js";

const mapSet = {
  id: "labels",
  minZoom: 2,
  maxZoom: 16,
  tileSize: 512 as const,
};

describe("Map Set Layer model", () => {
  it("uses only cached Tiles by default and makes misses transparent", () => {
    expect(
      resolvedMapSetLayerData({
        mapSet,
        allowProviderRequests: false,
        cachedTilesOnly: false,
        displayGeneration: 3,
      }),
    ).toEqual({
      kind: "xyz-tile-layer",
      tileUrl:
        "api/map-sets/labels/tiles/{z}/{x}/{y}?refresh=cache-only&displayGeneration=3&missing=transparent",
      minZoom: 2,
      maxZoom: 16,
      tileSize: 512,
    });
  });

  it("allows provider requests only when Layer and display options permit them", () => {
    const allowed = resolvedMapSetLayerData({
      mapSet,
      allowProviderRequests: true,
      cachedTilesOnly: false,
      displayGeneration: 1,
    });
    const globallyBlocked = resolvedMapSetLayerData({
      mapSet,
      allowProviderRequests: true,
      cachedTilesOnly: true,
      displayGeneration: 1,
    });

    expect(allowed.tileUrl).toBe(
      "api/map-sets/labels/tiles/{z}/{x}/{y}?missing=transparent",
    );
    expect(globallyBlocked.tileUrl).toContain("refresh=cache-only");
  });
});
