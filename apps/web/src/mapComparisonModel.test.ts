import { describe, expect, it } from "vitest";
import {
  canActivateMapComparison,
  mapComparisonZoomRange,
} from "./mapComparisonModel.js";

function mapSet(
  id: string,
  options: {
    interactive?: boolean;
    minZoom?: number;
    maxZoom?: number;
    tileSize?: 256 | 512;
  } = {},
) {
  return {
    id,
    minZoom: options.minZoom ?? 0,
    maxZoom: options.maxZoom ?? 18,
    tileSize: options.tileSize ?? 256,
    capabilities: { interactive: options.interactive ?? true },
  };
}

describe("Map comparison model", () => {
  it("intersects visual zoom ranges across 256- and 512-pixel sources", () => {
    expect(
      mapComparisonZoomRange([
        { minZoom: 0, maxZoom: 18, tileSize: 256 },
        { minZoom: 0, maxZoom: 17, tileSize: 512 },
      ]),
    ).toEqual({ minimum: 1, maximum: 18 });
  });

  it("exposes a reversed range when sources cannot be synchronized", () => {
    expect(
      mapComparisonZoomRange([
        { minZoom: 0, maxZoom: 1, tileSize: 256 },
        { minZoom: 2, maxZoom: 4, tileSize: 512 },
      ]),
    ).toEqual({ minimum: 3, maximum: 1 });
  });

  it("has no range without a source", () => {
    expect(mapComparisonZoomRange([])).toBeNull();
  });

  it("only activates a fully configured compatible comparison", () => {
    const preferences = {
      count: 2 as const,
      sources: [
        { mapSetId: "streets", tileSelection: { kind: "current" as const } },
        { mapSetId: null, tileSelection: { kind: "current" as const } },
      ],
    };
    expect(
      canActivateMapComparison(preferences, [
        mapSet("streets"),
        mapSet("satellite"),
      ]),
    ).toBe(false);

    preferences.sources[1] = {
      mapSetId: "streets",
      tileSelection: { kind: "current" },
    };
    expect(canActivateMapComparison(preferences, [mapSet("streets")])).toBe(
      true,
    );
  });

  it("rejects non-interactive Map Sets and disjoint visual zoom ranges", () => {
    const preferences = {
      count: 2 as const,
      sources: [
        { mapSetId: "left", tileSelection: { kind: "current" as const } },
        { mapSetId: "right", tileSelection: { kind: "current" as const } },
      ],
    };
    expect(
      canActivateMapComparison(preferences, [
        mapSet("left"),
        mapSet("right", { interactive: false }),
      ]),
    ).toBe(false);
    expect(
      canActivateMapComparison(preferences, [
        mapSet("left", { maxZoom: 1 }),
        mapSet("right", { minZoom: 2, tileSize: 512 }),
      ]),
    ).toBe(false);
  });
});
