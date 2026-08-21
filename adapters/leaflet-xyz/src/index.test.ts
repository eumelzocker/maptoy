import {
  createFakeMapRendererFactory,
  createMapRendererManifestRegistry,
  exerciseMapRendererContract,
} from "@maptoy/map-adapter-sdk";
import { describe, expect, it } from "vitest";
import {
  createLeafletXyzFactory,
  LEAFLET_XYZ_ADAPTER_ID,
  leafletXyzManifest,
} from "./index.js";

describe("Leaflet XYZ manifest", () => {
  it("passes registry validation", () => {
    const registry = createMapRendererManifestRegistry([leafletXyzManifest]);
    expect(registry.get(LEAFLET_XYZ_ADAPTER_ID)).toBe(leafletXyzManifest);
  });

  it("passes the renderer contract through its Leaflet bridge", async () => {
    const bridge = createFakeMapRendererFactory();
    const factory = createLeafletXyzFactory((options) =>
      bridge.create(options),
    );
    await expect(
      exerciseMapRendererContract(factory, {
        host: {} as HTMLElement,
        configuration: {
          tileUrl: "api/map-sets/test/tiles/{z}/{x}/{y}",
          attribution: "Test attribution",
          minZoom: 0,
          maxZoom: 18,
          tileSize: 256,
        },
      }),
    ).resolves.toBeUndefined();
  });
});
