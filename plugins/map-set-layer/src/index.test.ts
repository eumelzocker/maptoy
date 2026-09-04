import { describe, expect, it, vi } from "vitest";
import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import {
  mapSetLayerPlugin,
  validateMapSetLayerConfiguration,
} from "./index.js";

describe("Map Set layer plugin", () => {
  it("defaults provider access to disabled", () => {
    expect(validateMapSetLayerConfiguration({ mapSetId: "labels" })).toEqual({
      mapSetId: "labels",
      allowProviderRequests: false,
    });
  });

  it("rejects missing Map Set references", () => {
    expect(() => validateMapSetLayerConfiguration({})).toThrow(
      "configuration is invalid",
    );
  });

  it("satisfies the interactive plugin contract", async () => {
    await exerciseLayerPluginContract(mapSetLayerPlugin, {
      configuration: { mapSetId: "labels", allowProviderRequests: false },
      data: {},
      frontendContext: {
        instanceId: "map-set-layer",
        publishLayer: vi.fn(),
        clearLayer: vi.fn(),
        resolveAssetUrl: (assetId) => assetId,
      },
    });
  });
});
