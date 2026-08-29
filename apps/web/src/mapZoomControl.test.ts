import { describe, expect, it } from "vitest";
import {
  formatMapZoomLevel,
  formatMapZoomTitle,
  integerMapZoomTarget,
  mapZoomControlTarget,
  quarterStepMapZoomTarget,
} from "./mapZoomControl.js";

describe("map zoom control", () => {
  it("formats quarter-step zoom levels compactly", () => {
    expect([
      formatMapZoomLevel(7),
      formatMapZoomLevel(7.25),
      formatMapZoomLevel(7.5),
      formatMapZoomLevel(7.75),
    ]).toEqual(["7", "7¼", "7½", "7¾"]);
  });

  it("formats browser-title zoom levels in decimal quarter steps", () => {
    expect([
      formatMapZoomTitle(7),
      formatMapZoomTitle(7.24),
      formatMapZoomTitle(7.49),
      formatMapZoomTitle(7.76),
    ]).toEqual(["z7", "z7.25", "z7.5", "z7.75"]);
  });

  it("targets the next integer zoom in the requested direction", () => {
    expect(integerMapZoomTarget(5.75, "in")).toBe(6);
    expect(integerMapZoomTarget(5.75, "out")).toBe(5);
    expect(integerMapZoomTarget(5, "in")).toBe(6);
    expect(integerMapZoomTarget(5, "out")).toBe(4);
  });

  it("targets the next quarter-step zoom in the requested direction", () => {
    expect(quarterStepMapZoomTarget(5.5, "in")).toBe(5.75);
    expect(quarterStepMapZoomTarget(5.5, "out")).toBe(5.25);
    expect(quarterStepMapZoomTarget(5, "in")).toBe(5.25);
    expect(quarterStepMapZoomTarget(5, "out")).toBe(4.75);
  });

  it("uses Ctrl for quarter steps, Shift for integers, and clamps the range", () => {
    expect(
      mapZoomControlTarget(
        5.5,
        "in",
        { ctrlKey: true, shiftKey: false },
        0,
        10,
      ),
    ).toBe(5.75);
    expect(
      mapZoomControlTarget(
        5.5,
        "out",
        { ctrlKey: false, shiftKey: true },
        0,
        10,
      ),
    ).toBe(5);
    expect(
      mapZoomControlTarget(
        10,
        "in",
        { ctrlKey: false, shiftKey: false },
        0,
        10,
      ),
    ).toBe(10);
  });
});
