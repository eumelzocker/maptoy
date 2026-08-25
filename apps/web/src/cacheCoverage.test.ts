import type { TileCacheZoomStats } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import { cacheCoverageByZoom, formatCoveragePercent } from "./cacheCoverage.js";

function stats(zoom: number, logicalTileCount: number): TileCacheZoomStats {
  return {
    zoom,
    logicalTileCount,
    currentRevisionCount: logicalTileCount,
    historicalRevisionCount: 0,
    totalRevisionCount: logicalTileCount,
    indexedStorageBytes: 0,
  };
}

describe("cache coverage", () => {
  it("fills supported zoom levels and includes every supporting Map Set", () => {
    const levels = cacheCoverageByZoom(
      [stats(1, 4), stats(3, 1)],
      [
        { minZoom: 0, maxZoom: 2 },
        { minZoom: 1, maxZoom: 3 },
      ],
    );

    expect(
      levels.map(
        ({
          zoom,
          logicalTileCount,
          supportedMapSetCount,
          possibleTileCount,
        }) => [zoom, logicalTileCount, supportedMapSetCount, possibleTileCount],
      ),
    ).toEqual([
      [0, 0, 1, 1n],
      [1, 4, 2, 8n],
      [2, 0, 2, 32n],
      [3, 1, 1, 64n],
    ]);
    expect(levels[1]?.coveragePercent).toBe(50);
    expect(levels[3]?.coveragePercent).toBe(1.5625);
  });

  it("keeps cached levels outside the current supported ranges visible", () => {
    const [level] = cacheCoverageByZoom([stats(5, 1)], []);

    expect(level).toMatchObject({
      zoom: 5,
      logicalTileCount: 1,
      supportedMapSetCount: 0,
      possibleTileCount: 0n,
      coveragePercent: null,
    });
  });

  it("uses scientific notation instead of rounding tiny percentages to zero", () => {
    const formatted = formatCoveragePercent(3.552713678800501e-13);

    expect(formatted).toMatch(/3[.,]55E-13\s?%/);
    expect(formatCoveragePercent(0)).toBe("0 %");
    expect(formatCoveragePercent(null)).toBe("n/a");
  });
});
