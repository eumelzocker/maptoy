import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { imageLayerPlugin } from "./index.js";

describe("image layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    const drawPoint = vi.fn();
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
          opacity: 0.6,
          project: ({ longitude, latitude }) => ({
            x: longitude,
            y: latitude,
          }),
          surface: {
            drawPolyline: vi.fn(),
            drawPoint,
            drawManagedImage: vi.fn(),
          },
        },
      }),
    ).resolves.toBeUndefined();
    expect(drawPoint).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ opacity: 0.6 }),
    );
  });
});
