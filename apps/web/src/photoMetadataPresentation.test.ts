import { describe, expect, it } from "vitest";
import { photoMetadataRows } from "./photoMetadataPresentation.js";

describe("Photo metadata presentation", () => {
  it("shows every stored Photo metadata field independently of popup settings", () => {
    expect(
      photoMetadataRows({
        capturedAt: "2026:09:01 12:34:56",
        manufacturer: "Fujifilm",
        cameraModel: "X-T5",
        iso: 400,
        fStop: 5.6,
        shutterSpeed: 0.004,
        iptc: { caption: "Historic sailing ship" },
      }),
    ).toEqual([
      { label: "Captured at", value: "2026:09:01 12:34:56" },
      { label: "Manufacturer", value: "Fujifilm" },
      { label: "Camera model", value: "X-T5" },
      { label: "ISO", value: "400" },
      { label: "F-stop", value: "f/5.6" },
      { label: "Shutter speed", value: "1/250 s" },
      { label: "IPTC caption", value: "Historic sailing ship" },
    ]);
  });

  it("omits unavailable metadata", () => {
    expect(photoMetadataRows(undefined)).toEqual([]);
    expect(photoMetadataRows({ cameraModel: "X-T5" })).toEqual([
      { label: "Camera model", value: "X-T5" },
    ]);
  });
});
