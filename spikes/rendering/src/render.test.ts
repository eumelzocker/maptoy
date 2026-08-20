import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import sharp from "sharp";
import { ARTIFACT_ROOT, MOSAIC_HEIGHT, MOSAIC_WIDTH } from "./config.js";
import { generateFixtures } from "./fixtures.js";
import { assertManagedFixturePath } from "./plugins.js";
import { renderNative } from "./render-native.js";

test("the native renderer produces a fully covered 3x3 mosaic", async () => {
  const fixtures = await generateFixtures();
  const output = await renderNative(fixtures);
  const { data, info } = await sharp(output)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(info.width, MOSAIC_WIDTH);
  assert.equal(info.height, MOSAIC_HEIGHT);
  assert.equal(info.channels, 4);

  for (let index = 3; index < data.length; index += 4) {
    assert.equal(data[index], 255, `transparent output pixel at byte ${index}`);
  }
});

test("layer assets cannot escape the managed fixture directory", () => {
  assert.doesNotThrow(() =>
    assertManagedFixturePath(
      path.join(ARTIFACT_ROOT, "assets"),
      path.join(ARTIFACT_ROOT, "assets", "track.geojson"),
    ),
  );
  assert.throws(() =>
    assertManagedFixturePath(
      path.join(ARTIFACT_ROOT, "assets"),
      path.join(ARTIFACT_ROOT, "outside.geojson"),
    ),
  );
});
