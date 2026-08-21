import { createDefaultMapSetInput, type MapSet } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { mapSetInput } from "./mapSetModels.js";

describe("Map Set form models", () => {
  it("creates an independent editable copy of a stored Map Set", () => {
    const source = reactive<MapSet>({
      ...createDefaultMapSetInput(),
      id: "00000000-0000-4000-8000-000000000000",
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    });

    const input = mapSetInput(source);
    input.defaultCenter.longitude = 7;

    expect(input.name).toBe("New Map Set");
    expect(source.defaultCenter.longitude).toBe(13.405);
    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("createdAt");
    expect(input).not.toHaveProperty("updatedAt");
  });
});
