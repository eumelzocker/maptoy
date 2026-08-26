import { test } from "node:test";
import assert from "node:assert/strict";
import { PostHistory } from "./dedupe.js";

class MemoryPostHistoryStorage {
  readonly values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items);
  }
}

test("reserves a target until its POST completes", async () => {
  const history = new PostHistory();
  const url = "http://localhost:4004/api/map-sets/4711/tiles/1/2/3";
  assert.equal(history.hasSeen(url), false);
  assert.equal(history.tryStart(url), true);
  assert.equal(history.tryStart(url), false);
  await history.complete(url);
  assert.equal(history.hasSeen(url), true);
});

test("different urls are tracked independently", async () => {
  const history = new PostHistory();
  history.tryStart("http://localhost:4004/a");
  await history.complete("http://localhost:4004/a");
  assert.equal(history.hasSeen("http://localhost:4004/a"), true);
  assert.equal(history.hasSeen("http://localhost:4004/b"), false);
});

test("allows a later attempt after a failed POST", () => {
  const history = new PostHistory();
  const url = "http://localhost:4004/target";
  assert.equal(history.tryStart(url), true);
  history.release(url);
  assert.equal(history.tryStart(url), true);
});

test("restores successful targets after a background lifecycle restart", async () => {
  const storage = new MemoryPostHistoryStorage();
  const url = "http://localhost:4004/session-target";

  const firstBackground = await PostHistory.load(storage);
  assert.equal(firstBackground.tryStart(url), true);
  await firstBackground.complete(url);

  const restartedBackground = await PostHistory.load(storage);
  assert.equal(restartedBackground.hasSeen(url), true);
  assert.equal(restartedBackground.tryStart(url), false);
});
