import { describe, expect, it } from "vitest";
import {
  wgs84BoundsToXyzTileRanges,
  wgs84ToXyz,
  xyzTileBounds,
} from "./index.js";

describe("wgs84ToXyz", () => {
  it("maps the origin to the center of the XYZ grid", () => {
    expect(wgs84ToXyz({ longitude: 0, latitude: 0 }, 1)).toEqual({
      zoom: 1,
      x: 1,
      y: 1,
    });
  });

  it("round-trips exact XYZ Tile bounds", () => {
    const bounds = xyzTileBounds({ zoom: 3, x: 4, y: 2 });

    expect(wgs84BoundsToXyzTileRanges(bounds, 3)).toEqual([
      { minimumX: 4, maximumX: 4, minimumY: 2, maximumY: 2 },
    ]);
  });

  it("splits bounds that cross the antimeridian", () => {
    expect(
      wgs84BoundsToXyzTileRanges(
        { west: 170, south: -10, east: -170, north: 10 },
        2,
      ),
    ).toEqual([
      { minimumX: 3, maximumX: 3, minimumY: 1, maximumY: 2 },
      { minimumX: 0, maximumX: 0, minimumY: 1, maximumY: 2 },
    ]);
  });
});
