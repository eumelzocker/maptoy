import { describe, expect, it } from "vitest";
import {
  createMapRendererManifestRegistry,
  exerciseMapRendererContract,
  MAP_ADAPTER_SDK_VERSION,
  type MapLayerDescriptor,
  type MapRendererFactory,
  type MapRendererInstance,
  type MapViewport,
} from "./index.js";

function fakeFactory(): MapRendererFactory {
  return {
    manifest: {
      id: "fake",
      version: "1.0.0",
      sdkVersion: MAP_ADAPTER_SDK_VERSION,
      displayName: "Contract fake",
      configurationSchema: { type: "object" },
      capabilities: {
        interactive: true,
        layerRendering: true,
        serverExport: false,
        tileArchive: false,
      },
    },
    create(options): MapRendererInstance {
      let viewport: MapViewport = options.initialViewport;
      const layers = new Map<string, MapLayerDescriptor>();
      return {
        getViewport: () => viewport,
        setViewport: (value) => {
          viewport = value;
        },
        subscribe: () => () => undefined,
        attachLayer: (layer) => {
          layers.set(layer.id, layer);
        },
        updateLayer: (layer) => {
          if (!layers.has(layer.id)) {
            throw new Error("Layer is not attached.");
          }
          layers.set(layer.id, layer);
        },
        reorderLayers: (layerIds) => {
          if (layerIds.some((id) => !layers.has(id))) {
            throw new Error("Unknown layer in order.");
          }
        },
        removeLayer: (layerId) => {
          layers.delete(layerId);
        },
        geographicToScreen: ({ longitude, latitude }) => ({
          x: longitude,
          y: latitude,
        }),
        screenToGeographic: ({ x, y }) => ({ longitude: x, latitude: y }),
        destroy: () => {
          layers.clear();
        },
      };
    },
  };
}

describe("map renderer contract", () => {
  it("is satisfied by the SDK fake adapter", async () => {
    await expect(
      exerciseMapRendererContract(fakeFactory(), {
        host: {} as HTMLElement,
        configuration: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects duplicate registrations", () => {
    const manifest = fakeFactory().manifest;
    expect(() =>
      createMapRendererManifestRegistry([manifest, manifest]),
    ).toThrow("duplicate adapter id");
  });
});
