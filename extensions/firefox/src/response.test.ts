import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsResponseStatus,
  DEFAULT_MAX_RESPONSE_BYTES,
  mappedResponseHeaders,
  maximumResponseBytes,
  responseHeaderMapping,
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

test("maps configured source response headers case-insensitively", () => {
  const mapping = responseHeaderMapping({
    ...rule,
    forwardResponseHeaders: {
      ETag: "X-Archive-ETag",
      "last-modified": "X-Archive-Last-Modified",
    },
  });
  assert.deepEqual(mapping, {
    etag: "X-Archive-ETag",
    "last-modified": "X-Archive-Last-Modified",
  });
  assert.deepEqual(
    mappedResponseHeaders(
      [
        { name: "etag", value: 'W/"tile-2"' },
        { name: "Last-Modified", value: "Wed, 03 Sep 2026 10:00:00 GMT" },
        { name: "Cache-Control", value: "public" },
      ],
      mapping,
    ),
    {
      "X-Archive-ETag": 'W/"tile-2"',
      "X-Archive-Last-Modified": "Wed, 03 Sep 2026 10:00:00 GMT",
    },
  );
});

test("rejects invalid or ambiguous response header mappings", () => {
  assert.throws(
    () =>
      responseHeaderMapping({
        ...rule,
        forwardResponseHeaders: { "bad header": "X-Archive" },
      }),
    /Invalid source response header name/,
  );
  assert.throws(
    () =>
      responseHeaderMapping({
        ...rule,
        forwardResponseHeaders: { ETag: "Content-Type" },
      }),
    /forwarded automatically/,
  );
  assert.throws(
    () =>
      responseHeaderMapping({
        ...rule,
        forwardResponseHeaders: {
          ETag: "X-Archive-Validator",
          "Last-Modified": "x-archive-validator",
        },
      }),
    /Target request header is mapped more than once/,
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
