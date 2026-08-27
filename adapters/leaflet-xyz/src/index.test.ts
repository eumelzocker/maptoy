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
  leafletXyzZoomOptions,
} from "./index.js";

describe("Leaflet XYZ manifest", () => {
  it("passes registry validation", () => {
    const registry = createMapRendererManifestRegistry([leafletXyzManifest]);
    expect(registry.get(LEAFLET_XYZ_ADAPTER_ID)).toBe(leafletXyzManifest);
  });

  it("maps provider zoom levels to Leaflet display zooms", () => {
    expect(
      leafletXyzZoomOptions({ minZoom: 0, maxZoom: 18, tileSize: 256 }),
    ).toEqual({ minZoom: 0, maxZoom: 18, zoomOffset: 0 });
    expect(
      leafletXyzZoomOptions({ minZoom: 0, maxZoom: 18, tileSize: 512 }),
    ).toEqual({ minZoom: 1, maxZoom: 19, zoomOffset: -1 });
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
