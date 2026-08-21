import { createMapRendererManifestRegistry } from "@maptoy/map-adapter-sdk";
import { describe, expect, it } from "vitest";
import { LEAFLET_XYZ_ADAPTER_ID, leafletXyzManifest } from "./index.js";

describe("Leaflet XYZ manifest", () => {
  it("passes registry validation", () => {
    const registry = createMapRendererManifestRegistry([leafletXyzManifest]);
    expect(registry.get(LEAFLET_XYZ_ADAPTER_ID)).toBe(leafletXyzManifest);
  });
});
