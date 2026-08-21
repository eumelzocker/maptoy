import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { createDefaultMapSetInput, MapSetInputSchema } from "./index.js";

describe("Map Set contracts", () => {
  it("provides a valid XYZ default", () => {
    expect(Value.Check(MapSetInputSchema, createDefaultMapSetInput())).toBe(
      true,
    );
  });

  it("rejects invalid zoom and coordinate ranges", () => {
    expect(
      Value.Check(MapSetInputSchema, {
        ...createDefaultMapSetInput(),
        defaultCenter: { longitude: 181, latitude: 0 },
      }),
    ).toBe(false);
    expect(
      Value.Check(MapSetInputSchema, {
        ...createDefaultMapSetInput(),
        maxZoom: 25,
      }),
    ).toBe(false);
  });
});
