import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  it("creates the current schema from the production baseline", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "nested", "maptoy.sqlite");

    const database = await openDatabase(databasePath);
    expect(
      database.sqlite.prepare("SELECT version FROM schema_migrations").all(),
    ).toEqual([
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
      { version: 8 },
    ]);
    expect(
      database.sqlite
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name IN ('map_sets', 'source_revisions',
              'logical_tiles', 'tile_revisions', 'cache_snapshots',
              'layer_instances', 'layer_instance_versions', 'layer_assets', 'jobs')
            ORDER BY name`,
        )
        .all(),
    ).toEqual([
      { name: "cache_snapshots" },
      { name: "jobs" },
      { name: "layer_assets" },
      { name: "layer_instance_versions" },
      { name: "layer_instances" },
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
    expect(
      database.sqlite
        .prepare("PRAGMA table_info(tile_revisions)")
        .all()
        .map((column) => (column as { name: string }).name),
    ).toContain("origin");
    expect(
      database.sqlite
        .prepare("PRAGMA table_info(layer_instances)")
        .all()
        .map((column) => (column as { name: string }).name),
    ).not.toContain("map_set_id");
    expect(
      database.sqlite
        .prepare("PRAGMA table_info(layer_instance_versions)")
        .all()
        .map((column) => (column as { name: string }).name),
    ).toContain("opacity");
    database.close();
  });

  it("migrates existing version 4 data to provider revisions", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-v4-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "maptoy.sqlite");

    const baseline = new DatabaseSync(databasePath);
    baseline.exec("PRAGMA foreign_keys = ON;");
    baseline.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    baseline.exec(
      await readFile(
        new URL("../migrations/0004-initial-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    baseline
      .prepare(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (4, ?)",
      )
      .run("2026-08-22T00:00:00.000Z");
    baseline
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
    baseline
      .prepare(
        `INSERT INTO logical_tiles (
          id, map_set_id, zoom, tile_x, tile_y, current_revision_id
        ) VALUES (1, ?, 2, 2, 1, ?)`,
      )
      .run(
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      );
    baseline
      .prepare(
        `INSERT INTO tile_revisions (
          id, logical_tile_id, content_hash, file_path, content_type,
          byte_length, etag, last_modified, first_seen_at, last_seen_at,
          last_validated_at, selected_from, selected_until, validation_status
        ) VALUES (?, 1, ?, ?, 'image/png', 8, NULL, NULL, ?, ?, ?, ?, NULL, 'valid')`,
      )
      .run(
        "00000000-0000-4000-8000-000000000002",
        "baseline-hash",
        "tiles/00000000-0000-4000-8000-000000000001/2/2/1.baseline-hash.png",
        "2026-08-24T00:00:00.000Z",
        "2026-08-24T00:00:00.000Z",
        "2026-08-24T00:00:00.000Z",
        "2026-08-24T00:00:00.000Z",
      );
    baseline.close();

    const reopened = await openDatabase(databasePath);
    expect(
      reopened.sqlite
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
      { version: 8 },
    ]);
    expect(
      reopened.sqlite
        .prepare("SELECT name FROM map_sets WHERE id = ?")
        .get("00000000-0000-4000-8000-000000000001"),
    ).toEqual({ name: "Preserved Map Set" });
    expect(
      reopened.sqlite.prepare("SELECT id, origin FROM tile_revisions").get(),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      origin: "provider",
    });
    reopened.assertReady();
    reopened.close();
  });
});
