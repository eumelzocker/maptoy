import { describe, expect, it } from "vitest";
import {
  createFakeMapRendererFactory,
  createMapRendererFactoryRegistry,
  createMapRendererManifestRegistry,
  exerciseMapRendererContract,
  isMapRectangleLayerData,
} from "./index.js";

describe("map renderer contract", () => {
  it("is satisfied by the SDK fake adapter", async () => {
    await expect(
      exerciseMapRendererContract(fakeFactory(), {
        host: {} as HTMLElement,
        configuration: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("registers factories by manifest id", () => {
    const factory = createFakeMapRendererFactory();
    expect(createMapRendererFactoryRegistry([factory]).get("fake")).toBe(
      factory,
    );
  });

  it("rejects duplicate registrations", () => {
    const manifest = createFakeMapRendererFactory().manifest;
    expect(() =>
      createMapRendererManifestRegistry([manifest, manifest]),
    ).toThrow("duplicate adapter id");
  });

  it("recognizes neutral rectangle-grid Layer data", () => {
    expect(
      isMapRectangleLayerData({
        kind: "rectangle-grid",
        features: [
          {
            id: "cell",
            bounds: { west: 13, south: 52, east: 14, north: 53 },
            fillColor: "#16805d",
            strokeColor: "#17453c",
            fillOpacity: 0.5,
          },
        ],
      }),
    ).toBe(true);
    expect(isMapRectangleLayerData({ kind: "points", features: [] })).toBe(
      false,
    );
  });

  it("lets renderers constrain their viewport zoom without changing the SDK version", async () => {
    const renderer = await createFakeMapRendererFactory().create({
      host: {} as HTMLElement,
      configuration: {},
      initialViewport: {
        center: { longitude: 0, latitude: 0 },
        zoom: 8,
      },
    });

    await renderer.setZoomRange?.({ minimum: 0, maximum: 5 });
    expect(renderer.getViewport().zoom).toBe(5);
    await renderer.setViewport({
      center: { longitude: 0, latitude: 0 },
      zoom: 7,
    });
    expect(renderer.getViewport().zoom).toBe(5);
  });
});

function fakeFactory() {
  return createFakeMapRendererFactory();
}
