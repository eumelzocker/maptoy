import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE map_sets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        url_template TEXT NOT NULL,
        attribution TEXT NOT NULL,
        terms_url TEXT NOT NULL,
        notes TEXT NOT NULL,
        terms_reviewed_at TEXT NOT NULL,
        min_zoom INTEGER NOT NULL,
        max_zoom INTEGER NOT NULL,
        tile_size INTEGER NOT NULL,
        tile_format TEXT NOT NULL,
        subdomains_json TEXT NOT NULL,
        headers_json TEXT NOT NULL,
        source_projection TEXT NOT NULL,
        default_longitude REAL NOT NULL,
        default_latitude REAL NOT NULL,
        default_zoom REAL NOT NULL,
        renderer_id TEXT NOT NULL,
        capabilities_json TEXT NOT NULL,
        cache_policy_json TEXT NOT NULL,
        download_policy_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX map_sets_name_index ON map_sets(name COLLATE NOCASE);
    `,
  },
  {
    version: 2,
    sql: `
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

      CREATE UNIQUE INDEX source_revision_active_map_set_index
        ON source_revision_activations(map_set_id)
        WHERE selected_until IS NULL;
      CREATE INDEX source_revision_activation_time_index
        ON source_revision_activations(map_set_id, selected_from, selected_until);

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

      CREATE INDEX tile_revisions_logical_time_index
        ON tile_revisions(logical_tile_id, selected_from, selected_until);
      CREATE INDEX tile_revisions_file_path_index ON tile_revisions(file_path);

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
    `,
  },
  {
    version: 3,
    sql: `
      CREATE INDEX logical_tiles_map_set_zoom_index
        ON logical_tiles(map_set_id, zoom);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE logical_tiles_v4 (
        id INTEGER PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        zoom INTEGER NOT NULL,
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL,
        current_revision_id TEXT,
        UNIQUE (map_set_id, zoom, tile_x, tile_y)
      ) STRICT;

      INSERT INTO logical_tiles_v4 (
        id, map_set_id, zoom, tile_x, tile_y, current_revision_id
      )
      SELECT tile.id, tile.map_set_id, tile.zoom, tile.tile_x, tile.tile_y,
             tile.current_revision_id
        FROM logical_tiles tile
        JOIN source_revision_activations activation
          ON activation.map_set_id = tile.map_set_id
         AND activation.source_revision_id = tile.source_revision_id
         AND activation.selected_until IS NULL;

      CREATE TABLE tile_revisions_v4 (
        id TEXT PRIMARY KEY,
        logical_tile_id INTEGER NOT NULL REFERENCES logical_tiles_v4(id) ON DELETE CASCADE,
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

      INSERT INTO tile_revisions_v4
      SELECT revision.*
        FROM tile_revisions revision
        JOIN logical_tiles_v4 tile ON tile.id = revision.logical_tile_id;

      CREATE TABLE cache_snapshots_v4 (
        id TEXT PRIMARY KEY,
        map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (map_set_id, name)
      ) STRICT;

      INSERT INTO cache_snapshots_v4 (id, map_set_id, name, created_at)
      SELECT snapshot.id, snapshot.map_set_id, snapshot.name, snapshot.created_at
        FROM cache_snapshots snapshot
        JOIN source_revision_activations activation
          ON activation.map_set_id = snapshot.map_set_id
         AND activation.source_revision_id = snapshot.source_revision_id
         AND activation.selected_until IS NULL;

      CREATE TABLE cache_snapshot_tiles_v4 (
        snapshot_id TEXT NOT NULL REFERENCES cache_snapshots_v4(id) ON DELETE CASCADE,
        tile_revision_id TEXT NOT NULL REFERENCES tile_revisions_v4(id) ON DELETE RESTRICT,
        PRIMARY KEY (snapshot_id, tile_revision_id)
      ) STRICT;

      INSERT INTO cache_snapshot_tiles_v4 (snapshot_id, tile_revision_id)
      SELECT item.snapshot_id, item.tile_revision_id
        FROM cache_snapshot_tiles item
        JOIN cache_snapshots_v4 snapshot ON snapshot.id = item.snapshot_id
        JOIN tile_revisions_v4 revision ON revision.id = item.tile_revision_id;

      DROP TABLE cache_snapshot_tiles;
      DROP TABLE cache_snapshots;
      DROP TABLE tile_revisions;
      DROP TABLE logical_tiles;
      DROP TABLE source_revision_activations;
      DROP TABLE source_revisions;

      ALTER TABLE logical_tiles_v4 RENAME TO logical_tiles;
      ALTER TABLE tile_revisions_v4 RENAME TO tile_revisions;
      ALTER TABLE cache_snapshots_v4 RENAME TO cache_snapshots;
      ALTER TABLE cache_snapshot_tiles_v4 RENAME TO cache_snapshot_tiles;

      CREATE INDEX logical_tiles_map_set_zoom_index
        ON logical_tiles(map_set_id, zoom);
      CREATE INDEX tile_revisions_logical_time_index
        ON tile_revisions(logical_tile_id, selected_from, selected_until);
      CREATE INDEX tile_revisions_file_path_index ON tile_revisions(file_path);
    `,
  },
] as const;

export interface MaptoyDatabase {
  sqlite: DatabaseSync;
  close: () => void;
  assertReady: () => void;
}

export async function openDatabase(
  databasePath: string,
): Promise<MaptoyDatabase> {
  await mkdir(path.dirname(databasePath), { recursive: true });
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const appliedRows = sqlite
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map(({ version }) => version));

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    sqlite.exec("BEGIN IMMEDIATE;");
    try {
      sqlite.exec(migration.sql);
      sqlite
        .prepare(
          "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
        )
        .run(migration.version, new Date().toISOString());
      sqlite.exec("COMMIT;");
    } catch (error) {
      sqlite.exec("ROLLBACK;");
      sqlite.close();
      throw error;
    }
  }

  return {
    sqlite,
    close: () => sqlite.close(),
    assertReady: () => {
      sqlite.prepare("SELECT 1").get();
    },
  };
}
