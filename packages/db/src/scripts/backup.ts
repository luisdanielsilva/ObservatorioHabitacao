/**
 * Consistent online backup of the database (WBS 3.4.2), safe while the app is running.
 * Run nightly before the VPS backup: writes BACKUP_DIR/olhovivo-YYYY-MM-DD.db and keeps the
 * newest BACKUP_KEEP copies (default 14). Equivalent to `sqlite3 db ".backup file"`.
 */
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { defaultDatabasePath } from "../client";

const source = defaultDatabasePath();
const dir = process.env.BACKUP_DIR ?? path.join(path.dirname(source), "backups");
const keep = Number(process.env.BACKUP_KEEP ?? 14);

mkdirSync(dir, { recursive: true });
const target = path.join(dir, `olhovivo-${new Date().toISOString().slice(0, 10)}.db`);

const db = new Database(source, { readonly: true });
await db.backup(target);
db.close();

// Make the copy a single self-contained file (no WAL side files) and check it before
// pruning older backups.
const copy = new Database(target);
copy.pragma("journal_mode = DELETE");
const check = copy.pragma("quick_check", { simple: true });
copy.close();
if (check !== "ok") throw new Error(`backup integrity check failed: ${String(check)}`);

const backups = readdirSync(dir)
  .filter((f) => /^olhovivo-\d{4}-\d{2}-\d{2}\.db$/.test(f))
  .sort()
  .reverse();
for (const old of backups.slice(keep)) rmSync(path.join(dir, old));
console.log(`Backed up ${source} → ${target} (keeping ${Math.min(keep, backups.length)})`);
