import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { createDb, defaultDatabasePath, migrateDb } from "../client";
import { seed } from "../seed";

const path = defaultDatabasePath();
for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });
mkdirSync(dirname(path), { recursive: true });
const db = createDb(path);
migrateDb(db);
seed(db);
console.log(`Reset and seeded ${path}`);
