import { describe, expect, it } from "vitest";
import { tileCoordinateForLocation } from "./mapTileCalculator.js";

describe("Tile calculator", () => {
  it("calculates the XYZ tile containing a WGS84 location", () => {
    expect(
      tileCoordinateForLocation({
        zoom: 10,
        longitude: 13.405,
        latitude: 52.52,
      }),
    ).toEqual({ zoom: 10, x: 550, y: 335 });
  });

  it("rejects fractional zooms and coordinates outside the XYZ extent", () => {
    expect(
      tileCoordinateForLocation({ zoom: 10.5, longitude: 0, latitude: 0 }),
    ).toBeNull();
    expect(
      tileCoordinateForLocation({ zoom: 10, longitude: 180, latitude: 0 }),
    ).toBeNull();
    expect(
      tileCoordinateForLocation({ zoom: 10, longitude: 0, latitude: 86 }),
    ).toBeNull();
  });
});
