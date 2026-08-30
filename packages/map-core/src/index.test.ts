import { describe, expect, it } from "vitest";
import {
  geodesicDistanceMeters,
  metricScaleBar,
  segmentedMetricScale,
  wgs84BoundsToXyzTileRanges,
  wgs84ToXyz,
  xyzTileBounds,
  xyzToWgs84,
} from "./index.js";

describe("wgs84ToXyz", () => {
  it("maps the origin to the center of the XYZ grid", () => {
    expect(wgs84ToXyz({ longitude: 0, latitude: 0 }, 1)).toEqual({
      zoom: 1,
      x: 1,
      y: 1,
    });
  });

  it("maps fractional XYZ positions back to their visual Mercator latitude", () => {
    expect(xyzToWgs84({ zoom: 1, x: 1, y: 1 })).toEqual({
      longitude: 0,
      latitude: 0,
    });
    const northernCenter = xyzToWgs84({ zoom: 3, x: 4.5, y: 3.5 });
    const southernCenter = xyzToWgs84({ zoom: 3, x: 4.5, y: 4.5 });

    expect(northernCenter.longitude).toBeCloseTo(22.5);
    expect(northernCenter.latitude).toBeCloseTo(21.943_046);
    expect(southernCenter.latitude).toBeCloseTo(-northernCenter.latitude);
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

describe("map scale", () => {
  it("measures geodesic distances at the equator", () => {
    expect(
      geodesicDistanceMeters(
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
      ),
    ).toBeCloseTo(111_195, -1);
    expect(
      geodesicDistanceMeters(
        { longitude: 0, latitude: 60 },
        { longitude: 1, latitude: 60 },
      ),
    ).toBeCloseTo(55_597, -1);
  });

  it("selects a readable metric length that fits the available width", () => {
    expect(metricScaleBar(730, 120)).toEqual({
      distanceMeters: 500,
      width: (500 / 730) * 120,
      label: "500 m",
    });
    expect(metricScaleBar(3_200, 100)).toEqual({
      distanceMeters: 2_000,
      width: 62.5,
      label: "2 km",
    });
  });

  it.each([
    [182_000, [50, 100, 150, 182], ["50", "100", "150", "182 km"], 5, 2],
    [35_000, [10, 20, 30, 35], ["10", "20", "30", "35 km"], 1, 1],
    [17_000, [5, 10, 15, 17], ["5", "10", "15", "17 km"], 0.5, 0.5],
  ])(
    "segments a %d meter scale into three labeled intervals and ten subdivisions",
    (distance, expectedKilometers, expectedLabels, sectionKilometers, lastKilometers) => {
      const scale = segmentedMetricScale(distance);
      expect(scale.marks.map((mark) => mark.distanceMeters / 1000)).toEqual(
        expectedKilometers,
      );
      expect(scale.marks.map((mark) => mark.label)).toEqual(expectedLabels);
      expect(scale.sections[0]?.distanceMeters).toBe(sectionKilometers * 1000);
      expect(scale.sections.at(-1)?.distanceMeters).toBe(lastKilometers * 1000);
      expect(
        scale.sections.reduce((sum, section) => sum + section.width, 0),
      ).toBeCloseTo(1);
      expect(
        scale.sections.every(
          (section, index) => section.dark === (index % 2 === 0),
        ),
      ).toBe(true);
    },
  );
});
