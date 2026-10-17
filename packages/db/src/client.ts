import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/** `DATABASE_PATH`, or `data/observatorio-habitacao.db` at the repository root. */
export function defaultDatabasePath(): string {
  return (
    process.env.DATABASE_PATH ??
    path.join(packageDir(), "..", "..", "data", "observatorio-habitacao.db")
  );
}

/** Opens a database (":memory:" for tests) with WAL and foreign keys enabled. */
export function createDb(file = defaultDatabasePath()) {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

/** Applies pending migrations from `packages/db/drizzle`. */
export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder: path.join(packageDir(), "drizzle") });
}

/**
 * packages/db, from this file's location. Built with path functions rather than
 * `new URL(..., import.meta.url)`, which bundlers treat as an asset to include.
 */
function packageDir(): string {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}
