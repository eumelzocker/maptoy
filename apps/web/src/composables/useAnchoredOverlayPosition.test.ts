import { describe, expect, it } from "vitest";
import { useAnchoredOverlayPosition } from "./useAnchoredOverlayPosition.js";

describe("useAnchoredOverlayPosition", () => {
  it("starts hidden", () => {
    const { style } = useAnchoredOverlayPosition();
    expect(style.value.visibility).toBe("hidden");
  });

  it("does nothing when the anchor or content elements are not mounted", () => {
    const { style, reposition } = useAnchoredOverlayPosition();
    reposition("start");
    expect(style.value.visibility).toBe("hidden");
  });
});
