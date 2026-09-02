import { describe, expect, it } from "vitest";
import { mapComparisonZoomRange } from "./mapComparisonModel.js";

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
});
