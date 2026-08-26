import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatchingRule, buildTargetUrl, RuleError } from "./rules.js";
import type { RuleConfig } from "./types.js";

const placeholder = (name: string): string => `\${${name}}`;

const tileRule: RuleConfig = {
  id: "map-tiles",
  enabled: true,
  match:
    "^https://tiles\\.server\\.local/(?<mapname>[^/]+)/(?<z>\\d+)/(?<x>\\d+)/(?<y>\\d+)\\.(?<ext>\\w+)(?:\\?.*)?$",
  target: `http://localhost:4004/api/map-sets/${placeholder("mapname")}/tiles/${placeholder("z")}/${placeholder("x")}/${placeholder("y")}`,
  lookups: { mapname: { World: "4711-0815-abc" } },
};

test("matches a single rule and builds the target url (lookup + passthrough groups)", () => {
  const url = "https://tiles.server.local/World/11/1088/658.png";
  const rule = findMatchingRule(url, [tileRule]);
  assert.ok(rule);
  assert.equal(
    buildTargetUrl(url, rule),
    "http://localhost:4004/api/map-sets/4711-0815-abc/tiles/11/1088/658",
  );
});

test("matches urls with an optional trailing query string, ignoring it", () => {
  const url = "https://tiles.server.local/World/11/1088/658.png?arg=test";
  const rule = findMatchingRule(url, [tileRule]);
  assert.ok(rule);
  assert.equal(
    buildTargetUrl(url, rule),
    "http://localhost:4004/api/map-sets/4711-0815-abc/tiles/11/1088/658",
  );
});

test("matches urls with multiple query parameters, ignoring all of them", () => {
  const url =
    "https://tiles.server.local/World/11/1088/658.png?arg=test&arg2=42";
  const rule = findMatchingRule(url, [tileRule]);
  assert.ok(rule);
  assert.equal(
    buildTargetUrl(url, rule),
    "http://localhost:4004/api/map-sets/4711-0815-abc/tiles/11/1088/658",
  );
});

test("returns undefined when no rule matches", () => {
  assert.equal(
    findMatchingRule("https://example.com/foo", [tileRule]),
    undefined,
  );
});

test("ignores disabled rules", () => {
  const disabled = { ...tileRule, enabled: false };
  const url = "https://tiles.server.local/World/11/1088/658.png";
  assert.equal(findMatchingRule(url, [disabled]), undefined);
});

test("treats a rule as enabled when `enabled` is omitted (default true)", () => {
  const { enabled: _enabled, ...withoutEnabled } = tileRule;
  const url = "https://tiles.server.local/World/11/1088/658.png";
  assert.ok(findMatchingRule(url, [withoutEnabled as RuleConfig]));
});

test("throws RuleError when multiple enabled rules match the same url", () => {
  const duplicate = { ...tileRule, id: "map-tiles-2" };
  const url = "https://tiles.server.local/World/11/1088/658.png";
  assert.throws(() => findMatchingRule(url, [tileRule, duplicate]), RuleError);
});

test("throws RuleError when a lookup table has no entry for the matched value", () => {
  const url = "https://tiles.server.local/Mars/1/2/3.png";
  const rule = findMatchingRule(url, [tileRule]);
  assert.ok(rule);
  assert.throws(() => buildTargetUrl(url, rule), RuleError);
});

test("throws RuleError when the target template references an unknown group", () => {
  const badRule: RuleConfig = {
    ...tileRule,
    id: "bad",
    target: `http://localhost:4004/${placeholder("doesNotExist")}`,
  };
  const url = "https://tiles.server.local/World/11/1088/658.png";
  assert.throws(() => buildTargetUrl(url, badRule), RuleError);
});

test("groups without a lookup table are passed through unchanged", () => {
  const passthroughOnly: RuleConfig = {
    id: "passthrough",
    enabled: true,
    match: "^https://example\\.com/(?<any>[^/]+)$",
    target: `http://localhost:4004/echo/${placeholder("any")}`,
  };
  const url = "https://example.com/hello-world";
  assert.equal(
    buildTargetUrl(url, passthroughOnly),
    "http://localhost:4004/echo/hello-world",
  );
});
