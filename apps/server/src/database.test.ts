import { mkdtemp, rm } from "node:fs/promises";
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
  it("creates the Map Set and Tile Archive schemas once and reopens them", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "nested", "maptoy.sqlite");

    const first = await openDatabase(databasePath);
    expect(
      first.sqlite.prepare("SELECT version FROM schema_migrations").all(),
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }]);
    first.close();

    const second = await openDatabase(databasePath);
    expect(
      second.sqlite
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
      second.sqlite
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name IN (
              'source_revisions', 'source_revision_activations'
            )`,
        )
        .all(),
    ).toEqual([]);
    expect(
      second.sqlite
        .prepare("PRAGMA table_info(logical_tiles)")
        .all()
        .map((column) => (column as { name: string }).name),
    ).not.toContain("source_revision_id");
    second.close();
  });

  it("keeps the active source cache while removing the obsolete source-version model", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maptoy-db-v3-test-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "maptoy.sqlite");
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations VALUES
        (1, '2026-08-21T00:00:00.000Z'),
        (2, '2026-08-21T00:00:00.000Z'),
        (3, '2026-08-21T00:00:00.000Z');
      CREATE TABLE map_sets (id TEXT PRIMARY KEY) STRICT;
      INSERT INTO map_sets VALUES ('map-set');
      CREATE TABLE source_revisions (
        id TEXT PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        configuration_fingerprint TEXT NOT NULL,
        configuration_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (map_set_id, configuration_fingerprint)
      ) STRICT;
      CREATE TABLE source_revision_activations (
        id TEXT PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        source_revision_id TEXT NOT NULL REFERENCES source_revisions(id) ON DELETE RESTRICT,
        selected_from TEXT NOT NULL,
        selected_until TEXT
      ) STRICT;
      CREATE TABLE logical_tiles (
        id INTEGER PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        source_revision_id TEXT NOT NULL REFERENCES source_revisions(id) ON DELETE CASCADE,
        zoom INTEGER NOT NULL,
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL,
        current_revision_id TEXT,
        UNIQUE (source_revision_id, zoom, tile_x, tile_y)
      ) STRICT;
      CREATE TABLE tile_revisions (
        id TEXT PRIMARY KEY,
        logical_tile_id INTEGER NOT NULL REFERENCES logical_tiles(id) ON DELETE CASCADE,
        content_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL,
        etag TEXT,
        last_modified TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        last_validated_at TEXT NOT NULL,
        selected_from TEXT NOT NULL,
        selected_until TEXT,
        validation_status TEXT NOT NULL CHECK (validation_status IN ('valid'))
      ) STRICT;
      CREATE TABLE cache_snapshots (
        id TEXT PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        source_revision_id TEXT NOT NULL REFERENCES source_revisions(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (map_set_id, name)
      ) STRICT;
      CREATE TABLE cache_snapshot_tiles (
        snapshot_id TEXT NOT NULL REFERENCES cache_snapshots(id) ON DELETE CASCADE,
        tile_revision_id TEXT NOT NULL REFERENCES tile_revisions(id) ON DELETE RESTRICT,
        PRIMARY KEY (snapshot_id, tile_revision_id)
      ) STRICT;
      INSERT INTO source_revisions VALUES
        ('old-source', 'map-set', 'old', '{}', '2026-08-21T01:00:00.000Z'),
        ('active-source', 'map-set', 'active', '{}', '2026-08-21T02:00:00.000Z');
      INSERT INTO source_revision_activations VALUES
        ('old-activation', 'map-set', 'old-source', '2026-08-21T01:00:00.000Z', '2026-08-21T02:00:00.000Z'),
        ('active-activation', 'map-set', 'active-source', '2026-08-21T02:00:00.000Z', NULL);
      INSERT INTO logical_tiles VALUES
        (1, 'map-set', 'old-source', 3, 4, 2, 'old-revision'),
        (2, 'map-set', 'active-source', 3, 4, 2, 'active-revision');
      INSERT INTO tile_revisions VALUES
        ('old-revision', 1, 'old-hash', 'old.png', 'image/png', 10, NULL, NULL,
          '2026-08-21T01:00:00.000Z', '2026-08-21T01:00:00.000Z',
          '2026-08-21T01:00:00.000Z', '2026-08-21T01:00:00.000Z', NULL, 'valid'),
        ('active-revision', 2, 'active-hash', 'active.png', 'image/png', 12, NULL, NULL,
          '2026-08-21T02:00:00.000Z', '2026-08-21T02:00:00.000Z',
          '2026-08-21T02:00:00.000Z', '2026-08-21T02:00:00.000Z', NULL, 'valid');
      INSERT INTO cache_snapshots VALUES
        ('old-snapshot', 'map-set', 'old-source', 'old', '2026-08-21T01:30:00.000Z'),
        ('active-snapshot', 'map-set', 'active-source', 'active', '2026-08-21T02:30:00.000Z');
      INSERT INTO cache_snapshot_tiles VALUES
        ('old-snapshot', 'old-revision'),
        ('active-snapshot', 'active-revision');
    `);
    legacy.close();

    const migrated = await openDatabase(databasePath);
    expect(
      migrated.sqlite.prepare("SELECT id FROM logical_tiles").all(),
    ).toEqual([{ id: 2 }]);
    expect(
      migrated.sqlite.prepare("SELECT id FROM tile_revisions").all(),
    ).toEqual([{ id: "active-revision" }]);
    expect(
      migrated.sqlite.prepare("SELECT id FROM cache_snapshots").all(),
    ).toEqual([{ id: "active-snapshot" }]);
    expect(
      migrated.sqlite
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name LIKE 'source_revision%'`,
        )
        .all(),
    ).toEqual([]);
    migrated.close();
  });
});
