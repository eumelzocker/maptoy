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
  it("creates the current schema from the version 4 baseline", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "nested", "maptoy.sqlite");

    const database = await openDatabase(databasePath);
    expect(
      database.sqlite.prepare("SELECT version FROM schema_migrations").all(),
    ).toEqual([{ version: 4 }]);
    expect(
      database.sqlite
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name IN ('map_sets', 'source_revisions',
              'logical_tiles', 'tile_revisions', 'cache_snapshots')
            ORDER BY name`,
        )
        .all(),
    ).toEqual([
      { name: "cache_snapshots" },
      { name: "logical_tiles" },
      { name: "map_sets" },
      { name: "tile_revisions" },
    ]);
    expect(
      database.sqlite
        .prepare("PRAGMA table_info(logical_tiles)")
        .all()
        .map((column) => (column as { name: string }).name),
    ).not.toContain("source_revision_id");
    database.close();
  });

  it("reopens an existing version 4 database without rerunning the baseline", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-v4-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "maptoy.sqlite");

    const first = await openDatabase(databasePath);
    first.sqlite
      .prepare(
        `INSERT INTO map_sets (
          id, name, source_type, url_template, attribution, terms_url, notes,
          terms_reviewed_at, min_zoom, max_zoom, tile_size, tile_format,
          subdomains_json, headers_json, source_projection, default_longitude,
          default_latitude, default_zoom, renderer_id, capabilities_json,
          cache_policy_json, download_policy_json, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
      )
      .run(
        "00000000-0000-4000-8000-000000000001",
        "Preserved Map Set",
        "xyz-raster",
        "https://tiles.example.test/{z}/{x}/{y}.png",
        "Example",
        "",
        "",
        "",
        0,
        18,
        256,
        "png",
        "[]",
        "{}",
        "EPSG:3857",
        0,
        0,
        2,
        "leaflet-xyz",
        "{}",
        "{}",
        "{}",
        "2026-08-24T00:00:00.000Z",
        "2026-08-24T00:00:00.000Z",
      );
    first.close();

    const reopened = await openDatabase(databasePath);
    expect(
      reopened.sqlite
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([{ version: 4 }]);
    expect(
      reopened.sqlite
        .prepare("SELECT name FROM map_sets WHERE id = ?")
        .get("00000000-0000-4000-8000-000000000001"),
    ).toEqual({ name: "Preserved Map Set" });
    reopened.assertReady();
    reopened.close();
  });
});
