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
          opacity: 0.6,
          project: ({ longitude, latitude }) => ({
            x: longitude,
            y: latitude,
          }),
          surface: {
            drawPolyline: vi.fn(),
            drawPoint: vi.fn(),
          },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("migrates the former line opacity into the general Layer opacity", async () => {
    const migration = trackLayerPlugin.shared.migrations[0];
    expect(migration?.migrateLayer).toBeDefined();

    const migrated = await migration?.migrateLayer?.({
      configuration: {
        lineColor: "#123456",
        lineWidth: 5,
        lineOpacity: 0.5,
      },
      data: { features: [] },
      opacity: 0.8,
    });

    expect(migrated).toEqual({
      configuration: { lineColor: "#123456", lineWidth: 5 },
      data: { features: [] },
      opacity: 0.4,
    });
  });

  it("uses the general Layer opacity as the only Track opacity", async () => {
    const publishLayer = vi.fn();
    const data = {
      features: [
        {
          id: "track",
          geometry: {
            type: "LineString" as const,
            vertices: [
              { coordinate: { longitude: 13.4, latitude: 52.5 } },
              { coordinate: { longitude: 13.5, latitude: 52.6 } },
            ],
          },
          properties: {},
        },
      ],
    };
    const handle = await trackLayerPlugin.frontend.mount(
      {
        instanceId: "track",
        publishLayer,
        clearLayer: vi.fn(),
        resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
      },
      {
        configuration: {},
        data,
        assets: [],
        opacity: 0.35,
        visible: true,
      },
    );

    expect(publishLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: [
            expect.objectContaining({
              symbolizer: expect.objectContaining({ opacity: 1 }),
            }),
          ],
        }),
      }),
    );

    const drawPolyline = vi.fn();
    await trackLayerPlugin.server.render({
      configuration: {},
      data,
      assets: [],
      opacity: 0.35,
      project: ({ longitude, latitude }) => ({ x: longitude, y: latitude }),
      surface: {
        drawPolyline,
        drawPoint: vi.fn(),
      },
    });
    expect(drawPolyline).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ opacity: 0.35 }),
    );
    await handle.destroy();
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
