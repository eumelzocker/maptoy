import { describe, expect, it } from "vitest";
import { normalizeClipCopyText } from "./documentationClipCopy.js";

describe("documentation clipboard copy", () => {
  it.each([
    ["EPSG:3857", "EPSG:3857"],
    ["  EPSG:3857  ", "EPSG:3857"],
    ["\n  docker compose up\n", "docker compose up"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeClipCopyText(input)).toBe(expected);
  });
});
