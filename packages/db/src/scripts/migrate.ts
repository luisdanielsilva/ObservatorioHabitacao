import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createDb, defaultDatabasePath, migrateDb } from "../client";

const path = defaultDatabasePath();
mkdirSync(dirname(path), { recursive: true });
migrateDb(createDb(path));
console.log(`Migrated ${path}`);
