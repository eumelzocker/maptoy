import type { Layer, LayerAsset } from "@maptoy/contracts";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLayersStore } from "./layers.js";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../api.js", () => ({ apiRequest: apiRequestMock }));

function photoLayer(): Layer {
  return {
    id: "layer-1",
    name: "Photos",
    pluginId: "photo-layer",
    pluginVersion: "0.2.0",
    schemaVersion: 1,
    configuration: {},
    data: {},
    visible: true,
    displayOrder: 0,
    opacity: 1,
    minimumZoom: null,
    maximumZoom: null,
    status: "ready",
    diagnostic: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function photoAsset(id: string): LayerAsset {
  return {
    id,
    layerId: "layer-1",
    kind: "external-photo",
    status: "ready",
    fileName: `${id}.jpg`,
    contentType: "image/jpeg",
    byteLength: 100,
    contentHash: `hash-${id}`,
    relativePath: `${id}.jpg`,
    sourceModifiedAt: "2026-08-31T00:00:00.000Z",
    width: 10,
    height: 10,
    longitude: null,
    latitude: null,
    coordinateSource: "none",
    bounds: null,
    previewAvailable: true,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

describe("layers store Asset pagination", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRequestMock.mockReset();
  });

  it("loads Layer metadata without eagerly requesting every Asset page", async () => {
    apiRequestMock.mockResolvedValueOnce({ items: [photoLayer()] });
    const store = useLayersStore();

    await store.load();

    expect(apiRequestMock).toHaveBeenCalledOnce();
    expect(apiRequestMock).toHaveBeenCalledWith("api/layers");
    expect(store.assetsLoaded("layer-1")).toBe(false);
  });

  it("loads and appends cursor pages only when requested", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        items: [photoAsset("asset-1")],
        nextCursor: "asset-1",
      })
      .mockResolvedValueOnce({
        items: [photoAsset("asset-2")],
        nextCursor: null,
      });
    const store = useLayersStore();

    await store.ensureAssets("layer-1");
    expect(store.assetsByLayer["layer-1"]).toHaveLength(1);
    expect(store.hasMoreAssets("layer-1")).toBe(true);

    await store.loadMoreAssets("layer-1");
    expect(store.assetsByLayer["layer-1"]?.map(({ id }) => id)).toEqual([
      "asset-1",
      "asset-2",
    ]);
    expect(store.hasMoreAssets("layer-1")).toBe(false);
    expect(apiRequestMock.mock.calls).toEqual([
      ["api/layers/layer-1/assets?limit=200"],
      ["api/layers/layer-1/assets?cursor=asset-1&limit=200"],
    ]);
  });
});
