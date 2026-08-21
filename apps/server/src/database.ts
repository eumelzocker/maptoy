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
