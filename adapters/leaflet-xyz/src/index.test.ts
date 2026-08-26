import {
  createFakeMapRendererFactory,
  createMapRendererManifestRegistry,
  exerciseMapRendererContract,
} from "@maptoy/map-adapter-sdk";
import { describe, expect, it } from "vitest";
import {
  createLeafletXyzFactory,
  formatLeafletZoomLevel,
  integerLeafletZoomTarget,
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

  it("formats quarter-step zoom levels compactly", () => {
    expect([
      formatLeafletZoomLevel(7),
      formatLeafletZoomLevel(7.25),
      formatLeafletZoomLevel(7.5),
      formatLeafletZoomLevel(7.75),
    ]).toEqual(["7", "7¼", "7½", "7¾"]);
  });

  it("targets the next integer zoom in the requested direction", () => {
    expect(integerLeafletZoomTarget(5.75, "in")).toBe(6);
    expect(integerLeafletZoomTarget(5.75, "out")).toBe(5);
    expect(integerLeafletZoomTarget(5, "in")).toBe(6);
    expect(integerLeafletZoomTarget(5, "out")).toBe(4);
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
