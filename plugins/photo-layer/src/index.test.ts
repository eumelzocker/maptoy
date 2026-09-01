import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { photoLayerPlugin } from "./index.js";

describe("Photo layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    const drawPoint = vi.fn();
    await expect(
      exerciseLayerPluginContract(photoLayerPlugin, {
        configuration: {},
        data: {},
        frontendContext: {
          instanceId: "photos",
          publishLayer: vi.fn(),
          clearLayer: vi.fn(),
          resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
        },
        renderContext: {
          configuration: {},
          data: {},
          assets: [
            {
              assetId: "photo",
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
          },
        },
      }),
    ).resolves.toBeUndefined();
    expect(drawPoint).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ opacity: 0.6 }),
    );
  });

  it("publishes only the code-configured preview details", () => {
    const publishLayer = vi.fn();
    photoLayerPlugin.frontend.mount(
      {
        instanceId: "photos",
        publishLayer,
        clearLayer: vi.fn(),
        resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
      },
      {
        configuration: { showPreviews: true },
        data: {},
        assets: [
          {
            id: "photo",
            status: "ready",
            fileName: "ship.jpg",
            previewUrl: "api/assets/photo",
            longitude: 13.405,
            latitude: 52.52,
            metadata: {
              capturedAt: "2026:09:01 12:34:56",
              manufacturer: "Fujifilm",
              cameraModel: "X-T5",
              iso: 125,
              fStop: 5.6,
              shutterSpeed: 0.004,
              iptc: { caption: "Historic sailing ship" },
            },
          },
        ],
        opacity: 1,
        visible: true,
      },
    );

    expect(publishLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layers: [
            expect.objectContaining({
              clustering: { enabled: true, radiusPixels: 48 },
              features: [
                expect.objectContaining({
                  popupLines: [
                    "ship.jpg",
                    `52°31'12.0"N, 13°24'18.0"E`,
                    "Captured: 2026:09:01 12:34:56",
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
    );
  });
});
