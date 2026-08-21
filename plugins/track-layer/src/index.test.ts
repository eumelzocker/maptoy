import { exerciseLayerPluginContract } from "@maptoy/layer-plugin-sdk";
import { describe, expect, it } from "vitest";
import { trackLayerPlugin } from "./index.js";

describe("track layer plugin", () => {
  it("passes the shared plugin contract", async () => {
    await expect(
      exerciseLayerPluginContract(trackLayerPlugin, {
        configuration: {},
        data: {},
      }),
    ).resolves.toBeUndefined();
  });
});
