import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsResponseStatus,
  DEFAULT_MAX_RESPONSE_BYTES,
  maximumResponseBytes,
  ResponseBodyCollector,
} from "./response.js";
import type { ExtensionConfig, RuleConfig } from "./types.js";

const rule: RuleConfig = {
  id: "generic",
  match: "example",
  target: "http://localhost/target",
};
const config: ExtensionConfig = { rules: [rule] };

test("uses a generic global response limit with rule-level overrides", () => {
  assert.equal(maximumResponseBytes(config, rule), DEFAULT_MAX_RESPONSE_BYTES);
  assert.equal(
    maximumResponseBytes({ ...config, maxResponseBytes: 1_024 }, rule),
    1_024,
  );
  assert.equal(
    maximumResponseBytes({ ...config, maxResponseBytes: null }, rule),
    null,
  );
  assert.equal(
    maximumResponseBytes(config, { ...rule, maxResponseBytes: null }),
    null,
  );
  assert.throws(
    () => maximumResponseBytes(config, { ...rule, maxResponseBytes: 0 }),
    /positive integer/,
  );
});

test("accepts successful source responses by default and configured statuses explicitly", () => {
  assert.equal(acceptsResponseStatus(200, rule), true);
  assert.equal(acceptsResponseStatus(299, rule), true);
  assert.equal(acceptsResponseStatus(404, rule), false);
  assert.equal(
    acceptsResponseStatus(404, { ...rule, responseStatusCodes: [200, 404] }),
    true,
  );
  assert.throws(
    () => acceptsResponseStatus(200, { ...rule, responseStatusCodes: [99] }),
    /valid HTTP status/,
  );
});

test("stops retaining chunks after the configured byte limit", () => {
  const collector = new ResponseBodyCollector(4);
  collector.add(Uint8Array.from([1, 2]).buffer);
  collector.add(Uint8Array.from([3, 4, 5]).buffer);

  assert.equal(collector.receivedBytes, 5);
  assert.equal(collector.tooLarge, true);
  assert.equal(collector.body(), undefined);
});

test("reassembles an accepted response byte-for-byte", () => {
  const collector = new ResponseBodyCollector(null);
  collector.add(Uint8Array.from([1, 2]).buffer);
  collector.add(Uint8Array.from([3, 4]).buffer);

  const body = collector.body();
  assert.ok(body);
  assert.deepEqual(new Uint8Array(body), Uint8Array.from([1, 2, 3, 4]));
});
