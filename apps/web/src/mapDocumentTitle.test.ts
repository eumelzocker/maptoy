import { describe, expect, it } from "vitest";
import { mapDocumentTitle } from "./mapDocumentTitle.js";

describe("mapDocumentTitle", () => {
  it("includes the full Map Set name when one is selected", () => {
    expect(mapDocumentTitle("Provider/Satellite/webp")).toBe(
      "maptoy - Provider/Satellite/webp",
    );
  });

  it("uses the application name without a selected Map Set", () => {
    expect(mapDocumentTitle(null)).toBe("maptoy");
  });
});
