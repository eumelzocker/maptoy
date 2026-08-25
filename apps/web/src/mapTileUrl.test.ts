import { describe, expect, it } from "vitest";
import { mapTileUrl } from "./mapTileUrl.js";

describe("map Tile URL", () => {
  it("keeps normal Tile URLs stable", () => {
    expect(
      mapTileUrl({
        mapSetId: "map-set-id",
        cachedTilesOnly: false,
        displayGeneration: 4,
      }),
    ).toBe("api/map-sets/map-set-id/tiles/{z}/{x}/{y}");
  });

  it("changes the cache-only URL for every display generation", () => {
    const first = mapTileUrl({
      mapSetId: "map-set-id",
      cachedTilesOnly: true,
      displayGeneration: 1,
    });
    const second = mapTileUrl({
      mapSetId: "map-set-id",
      cachedTilesOnly: true,
      displayGeneration: 3,
    });

    expect(first).toContain("refresh=cache-only");
    expect(first).not.toBe(second);
  });
});
