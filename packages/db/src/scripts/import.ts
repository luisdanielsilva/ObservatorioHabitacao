/**
 * Imports public data: `tsx src/scripts/import.ts <caop|ine|imi|rnal|euribor|rents|all>`.
 * Each run is recorded in ingestion_jobs. Safe to re-run.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDb, defaultDatabasePath, migrateDb } from "../client";
import { downloadCaop, importCaopFeatures, readCaopGeoPackage } from "../import/caop";
import { importEuribor } from "../import/euribor";
import { importImi } from "../import/imi";
import { importIne } from "../import/ine";
import { importRentUpdates } from "../import/rentUpdate";
import { importRnal } from "../import/rnal";
import { runImport } from "../import/run";

const target = process.argv[2] ?? "all";
const dbPath = defaultDatabasePath();
mkdirSync(dirname(dbPath), { recursive: true });
const db = createDb(dbPath);
migrateDb(db);
const rawDir = join(dirname(dbPath), "raw", "caop");

const tasks: Record<string, () => Promise<void>> = {
  caop: async () => {
    const counts = await runImport(db, "caop", "caop", async () => {
      const files = await downloadCaop(rawDir);
      const features = files.flatMap((f) => readCaopGeoPackage(f.path, f.region));
      return importCaopFeatures(db, features);
    });
    console.log("CAOP", counts);
  },
  ine: async () => {
    console.log("INE", await runImport(db, "ine", "ine-prices", () => importIne(db)));
  },
  imi: async () => {
    console.log("IMI", await runImport(db, "imi", "imi-rates", () => importImi(db)));
  },
  rnal: async () => {
    const out = join(dirname(dbPath), "raw", "rnal");
    console.log("RNAL", await runImport(db, "rnal", "rnal-counts", () => importRnal(db, out)));
  },
  rents: async () => {
    console.log(
      "Rent updates",
      await runImport(db, "dre", "rent-updates", () => importRentUpdates(db)),
    );
  },
  euribor: async () => {
    console.log("Euribor", await runImport(db, "ecb", "euribor", () => importEuribor(db)));
  },
};

const order = target === "all" ? ["caop", "ine", "imi", "euribor", "rents"] : [target];
for (const name of order) {
  const task = tasks[name];
  if (!task) {
    console.error(`Unknown import "${name}". Use: caop, ine, imi, rnal, euribor, rents or all.`);
    process.exit(1);
  }
  await task();
}
