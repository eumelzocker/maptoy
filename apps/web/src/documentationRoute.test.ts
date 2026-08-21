import { describe, expect, it } from "vitest";
import { documentationPageId } from "./documentationRoute.js";

describe("documentationPageId", () => {
  it.each([undefined, null, ""])(
    "uses the home page for an omitted route parameter (%s)",
    (value) => {
      expect(documentationPageId(value)).toBe("home");
    },
  );

  it("preserves an explicit page id", () => {
    expect(documentationPageId("getting-started")).toBe("getting-started");
  });
});
