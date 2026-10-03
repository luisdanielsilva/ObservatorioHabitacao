import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/** `DATABASE_PATH`, or `data/olhovivo.db` at the repository root. */
export function defaultDatabasePath(): string {
  return (
    process.env.DATABASE_PATH ??
    fileURLToPath(new URL("../../../data/olhovivo.db", import.meta.url))
  );
}

/** Opens a database (":memory:" for tests) with WAL and foreign keys enabled. */
export function createDb(path = defaultDatabasePath()) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

/** Applies pending migrations from `packages/db/drizzle`. */
export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
}
