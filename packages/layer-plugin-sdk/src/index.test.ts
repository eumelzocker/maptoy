import { describe, expect, it, vi } from "vitest";
import {
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
        context.publishLayer({ type: "fake", data: input.data });
        return {
          update: (nextInput) => {
            context.publishLayer({ type: "fake", data: nextInput.data });
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
