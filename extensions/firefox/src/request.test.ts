import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConfiguredRequest } from "./request.js";
import type { ExtensionConfig } from "./types.js";

const placeholder = (name: string): string => `\${${name}}`;

test("waits for stored configuration before matching a wake-up request", async () => {
  let resolveConfig: ((config: ExtensionConfig) => void) | undefined;
  const configReady = new Promise<ExtensionConfig>((resolve) => {
    resolveConfig = resolve;
  });
  const request = resolveConfiguredRequest(
    configReady,
    "https://tiles.example/3/4/5.png",
  );
  let settled = false;
  void request.then(() => {
    settled = true;
  });

  await Promise.resolve();
  assert.equal(settled, false);

  resolveConfig?.({
    enabled: true,
    rules: [
      {
        id: "tiles",
        match:
          "^https://tiles\\.example/(?<z>\\d+)/(?<x>\\d+)/(?<y>\\d+)\\.png$",
        target: `http://localhost:4004/tiles/${placeholder("z")}/${placeholder("x")}/${placeholder("y")}`,
      },
    ],
  });

  const configured = await request;
  assert.equal(configured?.targetUrl, "http://localhost:4004/tiles/3/4/5");
  assert.deepEqual(configured?.responseHeaderMapping, {});
});
