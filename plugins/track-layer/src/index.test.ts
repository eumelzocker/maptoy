import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { trackLayerPlugin } from "./index.js";

describe("track layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    await expect(
      exerciseLayerPluginContract(trackLayerPlugin, {
        configuration: {},
        data: {
          features: [
            {
              id: "track",
              geometry: {
                type: "LineString",
                vertices: [
                  { coordinate: { longitude: 13.4, latitude: 52.5 } },
                  { coordinate: { longitude: 13.5, latitude: 52.6 } },
                ],
              },
              properties: { name: "Fixture" },
            },
          ],
        },
        frontendContext: {
          instanceId: "track",
          publishLayer: vi.fn(),
          clearLayer: vi.fn(),
          resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
        },
        asset: {
          assetId: "track-file",
          fileName: "track.geojson",
          mimeType: "application/geo+json",
          bytes: new TextEncoder().encode(
            JSON.stringify({
              type: "LineString",
              coordinates: [
                [13.4, 52.5],
                [13.5, 52.6],
              ],
            }),
          ),
        },
        renderContext: {
          configuration: {},
          data: {
            features: [
              {
                id: "track",
                geometry: {
                  type: "LineString",
                  vertices: [
                    { coordinate: { longitude: 13.4, latitude: 52.5 } },
                    { coordinate: { longitude: 13.5, latitude: 52.6 } },
                  ],
                },
                properties: {},
              },
            ],
          },
          assets: [],
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

  it("normalizes GPX elevation and timestamps as line vertex data", async () => {
    const imported = await trackLayerPlugin.assetImport.importAsset({
      assetId: "gpx-file",
      fileName: "timed.gpx",
      mimeType: "application/gpx+xml",
      bytes: new TextEncoder().encode(`<?xml version="1.0"?>
        <gpx><trk><name>Morning</name><trkseg>
          <trkpt lat="52.5" lon="13.4"><ele>41.5</ele><time>2026-08-28T08:00:00Z</time></trkpt>
          <trkpt lat="52.6" lon="13.5"><ele>43</ele><time>2026-08-28T08:01:00Z</time></trkpt>
        </trkseg></trk></gpx>`),
    });

    expect(imported.data).toMatchObject({
      features: [
        {
          geometry: {
            type: "LineString",
            vertices: [
              {
                coordinate: { elevation: 41.5 },
                properties: { timestamp: "2026-08-28T08:00:00Z" },
              },
              {
                coordinate: { elevation: 43 },
                properties: { timestamp: "2026-08-28T08:01:00Z" },
              },
            ],
          },
        },
      ],
    });
  });
});
