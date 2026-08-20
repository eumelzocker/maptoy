import { describe, expect, it } from "vitest";
import { wgs84ToXyz } from "./index.js";

describe("wgs84ToXyz", () => {
  it("maps the origin to the center of the XYZ grid", () => {
    expect(wgs84ToXyz({ longitude: 0, latitude: 0 }, 1)).toEqual({
      zoom: 1,
      x: 1,
      y: 1,
    });
  });
});
