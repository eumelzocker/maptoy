import { describe, expect, it, vi } from "vitest";
import {
  assertAreaGeometry,
  assertLineGeometry,
  assertPointGeometry,
  createLayerPluginRegistry,
  exerciseLayerPluginContract,
  LAYER_PLUGIN_SDK_VERSION,
  type LayerPluginDefinition,
} from "./index.js";

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function fakePlugin(): LayerPluginDefinition {
  return {
    manifest: {
      id: "contract-fake",
      version: "1.0.0",
      sdkVersion: LAYER_PLUGIN_SDK_VERSION,
      displayName: "Contract fake",
      category: { id: "contract-features", displayName: "Contract features" },
      schemaVersion: 2,
      configurationSchema: { type: "object" },
      dataSchema: { type: "object" },
      capabilities: {
        interactive: true,
        assetImport: true,
        serverPreview: true,
        serverRender: true,
      },
    },
    shared: {
      validateConfiguration: expectRecord,
      validateData: expectRecord,
      migrations: [
        {
          fromSchemaVersion: 1,
          toSchemaVersion: 2,
          migrate: (value) => ({ ...expectRecord(value), migrated: true }),
        },
      ],
    },
    frontend: {
      mount: (context, input) => {
        void input;
        context.publishLayer({
          type: "point-collection",
          data: { kind: "point-collection", features: [] },
        });
        return {
          update: (nextInput) => {
            void nextInput;
            context.publishLayer({
              type: "point-collection",
              data: { kind: "point-collection", features: [] },
            });
          },
          destroy: context.clearLayer,
        };
      },
    },
    assetImport: {
      importAsset: (asset) => ({
        configuration: {},
        data: { byteLength: asset.bytes.byteLength },
        managedAssetIds: [asset.assetId],
      }),
    },
    server: {
      createPreview: (context) => {
        context.surface.drawPoint(
          { longitude: 13.4, latitude: 52.5 },
          { color: "blue" },
        );
      },
      render: (context) => {
        context.surface.drawPolyline(
          [
            { longitude: 13.4, latitude: 52.5 },
            { longitude: 13.5, latitude: 52.6 },
          ],
          { color: "blue" },
        );
      },
    },
  };
}

describe("layer plugin contract", () => {
  it("validates reusable point, line, and area geometries", () => {
    expect(() =>
      assertPointGeometry({
        type: "Point",
        coordinate: { longitude: 13.4, latitude: 52.5 },
      }),
    ).not.toThrow();
    expect(() =>
      assertLineGeometry({
        type: "LineString",
        vertices: [
          { coordinate: { longitude: 13.4, latitude: 52.5 } },
          { coordinate: { longitude: 13.5, latitude: 52.6 } },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertAreaGeometry({
        type: "Polygon",
        rings: [
          [
            { longitude: 13.4, latitude: 52.5 },
            { longitude: 13.5, latitude: 52.5 },
            { longitude: 13.5, latitude: 52.6 },
            { longitude: 13.4, latitude: 52.5 },
          ],
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertAreaGeometry({
        type: "Polygon",
        rings: [
          [
            { longitude: 13.4, latitude: 52.5 },
            { longitude: 13.5, latitude: 52.5 },
            { longitude: 13.5, latitude: 52.6 },
          ],
        ],
      }),
    ).toThrow("at least four coordinates");
  });

  it("exercises validation, migration, lifecycle, import, and rendering", async () => {
    const publishLayer = vi.fn();
    const clearLayer = vi.fn();
    const drawPoint = vi.fn();
    const drawPolyline = vi.fn();

    await expect(
      exerciseLayerPluginContract(fakePlugin(), {
        configuration: {},
        data: { migrated: true },
        migration: { fromSchemaVersion: 1, value: {} },
        frontendContext: {
          instanceId: "fixture-layer",
          publishLayer,
          clearLayer,
          resolveAssetUrl: (assetId) => `api/assets/${assetId}`,
        },
        asset: {
          assetId: "fixture-asset",
          fileName: "fixture.geojson",
          mimeType: "application/geo+json",
          bytes: new Uint8Array([1, 2, 3]),
        },
        renderContext: {
          configuration: {},
          data: {},
          assets: [],
          opacity: 0.6,
          project: ({ longitude, latitude }) => ({
            x: longitude,
            y: latitude,
          }),
          surface: {
            drawPolyline,
            drawPoint,
            drawManagedImage: vi.fn(),
          },
        },
      }),
    ).resolves.toBeUndefined();

    expect(publishLayer).toHaveBeenCalledTimes(2);
    expect(clearLayer).toHaveBeenCalledOnce();
    expect(drawPoint).toHaveBeenCalledOnce();
    expect(drawPolyline).toHaveBeenCalledOnce();
  });

  it("rejects duplicate registrations", () => {
    const plugin = fakePlugin();
    expect(() => createLayerPluginRegistry([plugin, plugin])).toThrow(
      "duplicate plugin id",
    );
  });

  it("rejects capabilities without their controlled hook", () => {
    const plugin = fakePlugin();
    expect(() =>
      createLayerPluginRegistry([{ ...plugin, frontend: undefined }]),
    ).toThrow("interactive capability and frontend hook disagree");
  });
});
