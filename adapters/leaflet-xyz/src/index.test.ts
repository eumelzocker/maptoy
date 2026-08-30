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
  leafletXyzTileDecoration,
  leafletXyzTileLabel,
  leafletXyzZoomOptions,
  nonOverlappingScaleMarkIndexes,
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

  it("labels the canonical source Tile for zoom offsets and wrapped worlds", () => {
    expect(leafletXyzTileLabel({ x: 5, y: 2, z: 3 }, 0)).toBe("3/5/2");
    expect(leafletXyzTileLabel({ x: 5, y: 2, z: 4 }, -1)).toBe("3/5/2");
    expect(leafletXyzTileLabel({ x: -1, y: 2, z: 3 }, 0)).toBe("3/7/2");
    expect(leafletXyzTileLabel({ x: 9, y: 2, z: 3 }, 0)).toBe("3/1/2");
  });

  it("derives a latitude-aware metric scale for each source Tile", () => {
    const northern = leafletXyzTileDecoration({ x: 4, y: 1, z: 3 }, 0, 75);
    const central = leafletXyzTileDecoration({ x: 4, y: 3, z: 3 }, 0, 75);
    const southern = leafletXyzTileDecoration({ x: 4, y: 4, z: 3 }, 0, 75);
    const wrapped = leafletXyzTileDecoration({ x: 12, y: 3, z: 3 }, 0, 75);

    expect(northern.label).toBe("3/4/1");
    expect(central.label).toBe("3/4/3");
    expect(northern.scale.distanceMeters).not.toBe(
      central.scale.distanceMeters,
    );
    expect(wrapped).toEqual(central);
    expect(southern.scale).toEqual(central.scale);
    expect(central.scale.marks).toHaveLength(4);
    expect(central.scale.sections.length).toBeGreaterThan(30);
  });

  it("keeps the endpoint and hides intermediate scale labels that collide", () => {
    expect(
      nonOverlappingScaleMarkIndexes([
        { left: 20, right: 35 },
        { left: 45, right: 60 },
        { left: 70, right: 88 },
        { left: 82, right: 120 },
      ]),
    ).toEqual([0, 1, 3]);
    expect(
      nonOverlappingScaleMarkIndexes([
        { left: 20, right: 42 },
        { left: 38, right: 60 },
        { left: 56, right: 78 },
        { left: 58, right: 100 },
      ]),
    ).toEqual([0, 3]);
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
