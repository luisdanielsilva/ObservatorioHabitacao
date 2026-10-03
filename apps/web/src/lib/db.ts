import "server-only";
import { createDb, type Db } from "@olhovivo/db";
import path from "node:path";

const globalForDb = globalThis as unknown as { olhovivoDb?: Db };

/**
 * The shared database connection. `DATABASE_PATH` overrides the default
 * `data/olhovivo.db` at the repository root (the app runs from apps/web).
 */
export function getDb(): Db {
  globalForDb.olhovivoDb ??= createDb(
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "../../data/olhovivo.db"),
  );
  return globalForDb.olhovivoDb;
}
