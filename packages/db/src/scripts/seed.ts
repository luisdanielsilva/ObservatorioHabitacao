import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createDb, defaultDatabasePath, migrateDb } from "../client";
import { seed } from "../seed";

const path = defaultDatabasePath();
mkdirSync(dirname(path), { recursive: true });
const db = createDb(path);
migrateDb(db);
seed(db);
console.log(`Seeded ${path}`);
