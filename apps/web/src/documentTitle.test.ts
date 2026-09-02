import { describe, expect, it } from "vitest";
import { applicationDocumentTitle } from "./documentTitle.js";

describe("applicationDocumentTitle", () => {
  it("includes the route and its context", () => {
    expect(applicationDocumentTitle("map", "Provider/Satellite/webp")).toBe(
      "maptoy - map - Provider/Satellite/webp",
    );
    expect(
      applicationDocumentTitle("map", "Provider/Satellite/webp", "z7.25"),
    ).toBe("maptoy - map - Provider/Satellite/webp - z7.25");
    expect(applicationDocumentTitle("docs", "Getting started")).toBe(
      "maptoy - docs - Getting started",
    );
    expect(applicationDocumentTitle("cache", "map-set-id")).toBe(
      "maptoy - cache - map-set-id",
    );
    expect(applicationDocumentTitle("coverage", "OpenTopoMap", "z12")).toBe(
      "maptoy - coverage - OpenTopoMap - z12",
    );
  });

  it("omits unavailable context", () => {
    expect(applicationDocumentTitle("map sets")).toBe("maptoy - map sets");
    expect(applicationDocumentTitle("map")).toBe("maptoy - map");
  });

  it("falls back to the application name without a known route", () => {
    expect(applicationDocumentTitle(null)).toBe("maptoy");
  });
});
