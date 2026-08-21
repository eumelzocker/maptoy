import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it } from "vitest";
import { imageLayerPlugin } from "./index.js";

describe("image layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    await expect(
      exerciseLayerPluginContract(imageLayerPlugin, {
        configuration: {},
        data: {},
      }),
    ).resolves.toBeUndefined();
  });
});
