import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TILE_X,
  MAX_TILE_Y,
  MIN_TILE_X,
  MIN_TILE_Y,
  MOSAIC_HEIGHT,
  MOSAIC_WIDTH,
} from "./config.js";
import {
  lonLatToMosaicPixel,
  lonLatToWorldPixel,
  tileCornerToLonLat,
  worldPixelToLonLat,
} from "./geo.js";

test("WGS84 coordinates round-trip through XYZ world pixels", () => {
  const coordinate = {lon: 13.405, lat: 52.52};
  const result = worldPixelToLonLat(lonLatToWorldPixel(coordinate));
  assert.ok(Math.abs(result.lon - coordinate.lon) < 1e-10);
  assert.ok(Math.abs(result.lat - coordinate.lat) < 1e-10);
});

test("the configured tile corners map to the mosaic corners", () => {
  const northwest = tileCornerToLonLat(MIN_TILE_X, MIN_TILE_Y);
  const southeast = tileCornerToLonLat(MAX_TILE_X + 1, MAX_TILE_Y + 1);
  const northwestPixel = lonLatToMosaicPixel(northwest);
  const southeastPixel = lonLatToMosaicPixel(southeast);

  assert.ok(Math.abs(northwestPixel.x) < 1e-8);
  assert.ok(Math.abs(northwestPixel.y) < 1e-8);
  assert.ok(Math.abs(southeastPixel.x - MOSAIC_WIDTH) < 1e-8);
  assert.ok(Math.abs(southeastPixel.y - MOSAIC_HEIGHT) < 1e-8);
});

test("latitude is clamped at the Web Mercator limit", () => {
  const northPole = lonLatToWorldPixel({lon: 0, lat: 90});
  const mercatorLimit = lonLatToWorldPixel({
    lon: 0,
    lat: 85.0511287798066,
  });
  assert.deepEqual(northPole, mercatorLimit);
});
