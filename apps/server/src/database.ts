import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrationFiles = [
  { version: 4, filename: "0004-initial-schema.sql" },
] as const;

async function loadMigrations(): Promise<
  Array<{ version: number; sql: string }>
> {
  return Promise.all(
    migrationFiles.map(async ({ version, filename }) => ({
      version,
      sql: await readFile(
        new URL(`../migrations/${filename}`, import.meta.url),
        "utf8",
      ),
    })),
  );
}

export interface MaptoyDatabase {
  sqlite: DatabaseSync;
  close: () => void;
  assertReady: () => void;
}

export async function openDatabase(
  databasePath: string,
): Promise<MaptoyDatabase> {
  const migrations = await loadMigrations();
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
