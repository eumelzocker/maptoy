import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { imageLayerPlugin } from "./index.js";

describe("image layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    await expect(
      exerciseLayerPluginContract(imageLayerPlugin, {
        configuration: {},
        data: {},
        frontendContext: {
          instanceId: "images",
          publishLayer: vi.fn(),
          clearLayer: vi.fn(),
          resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
        },
        renderContext: {
          configuration: {},
          data: {},
          assets: [
            {
              assetId: "image",
              longitude: 13.4,
              latitude: 52.5,
            },
          ],
          project: ({ longitude, latitude }) => ({
            x: longitude,
            y: latitude,
          }),
          surface: {
            drawPolyline: vi.fn(),
            drawPoint: vi.fn(),
            drawManagedImage: vi.fn(),
          },
        },
      }),
    ).resolves.toBeUndefined();
  });
});
