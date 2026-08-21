import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./database.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("database migrations", () => {
  it("creates the Map Set schema once and reopens it", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "nested", "maptoy.sqlite");

    const first = await openDatabase(databasePath);
    expect(
      first.sqlite.prepare("SELECT version FROM schema_migrations").all(),
    ).toEqual([{ version: 1 }]);
    first.close();

    const second = await openDatabase(databasePath);
    expect(
      second.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'map_sets'",
        )
        .get(),
    ).toEqual({ name: "map_sets" });
    second.close();
  });
});
