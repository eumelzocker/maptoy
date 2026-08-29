import { describe, expect, it } from "vitest";
import {
  formatLatitude,
  formatLongitude,
  latitudeToDmm,
  latitudeToDms,
  longitudeToDmm,
  longitudeToDms,
} from "./coordinateFormat.js";

describe("Coordinate format conversion", () => {
  it("formats longitude and latitude in DMS with a hemisphere suffix", () => {
    expect(longitudeToDms(2.3522)).toBe(`2°21'7.9"E`);
    expect(longitudeToDms(-2.3522)).toBe(`2°21'7.9"W`);
    expect(latitudeToDms(48.8566)).toBe(`48°51'23.8"N`);
    expect(latitudeToDms(-48.8566)).toBe(`48°51'23.8"S`);
  });

  it("formats longitude and latitude in DMM with a hemisphere suffix", () => {
    expect(longitudeToDmm(2.3522)).toBe(`2°21.132'E`);
    expect(longitudeToDmm(-2.3522)).toBe(`2°21.132'W`);
    expect(latitudeToDmm(48.8566)).toBe(`48°51.396'N`);
    expect(latitudeToDmm(-48.8566)).toBe(`48°51.396'S`);
  });

  it("carries rounded seconds and minutes into the next degree", () => {
    expect(longitudeToDms(12.999999)).toBe(`13°0'0.0"E`);
    expect(longitudeToDmm(-12.999999)).toBe(`13°0.000'W`);
  });

  it("returns an em dash for non-finite values", () => {
    expect(longitudeToDms(Number.NaN)).toBe("—");
    expect(latitudeToDms(Number.NaN)).toBe("—");
    expect(longitudeToDmm(Number.NaN)).toBe("—");
    expect(latitudeToDmm(Number.NaN)).toBe("—");
  });

  it("dispatches to the requested format", () => {
    expect(formatLongitude(2.3522, "dd")).toBe("2.35220");
    expect(formatLongitude(2.3522, "dms")).toBe(`2°21'7.9"E`);
    expect(formatLongitude(2.3522, "dmm")).toBe(`2°21.132'E`);
    expect(formatLatitude(48.8566, "dd")).toBe("48.85660");
    expect(formatLatitude(48.8566, "dms")).toBe(`48°51'23.8"N`);
    expect(formatLatitude(48.8566, "dmm")).toBe(`48°51.396'N`);
  });
});
