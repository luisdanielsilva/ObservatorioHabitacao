import "server-only";
import { createDb, type Db } from "@observatorio-habitacao/db";
import path from "node:path";

const globalForDb = globalThis as unknown as { observatorioHabitacaoDb?: Db };

/**
 * The shared database connection. `DATABASE_PATH` overrides the default
 * `data/observatorio-habitacao.db` at the repository root (the app runs from apps/web).
 */
export function getDb(): Db {
  globalForDb.observatorioHabitacaoDb ??= createDb(
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "../../data/observatorio-habitacao.db"),
  );
  return globalForDb.observatorioHabitacaoDb;
}
