/**
 * One-off: adds the IRS brackets (introduced in the ParameterSet on 2026-10-04) to parameter
 * sets stored before they existed. Sets for other years are left alone and reported; they need
 * a new version with the brackets for their year.
 */
import { eq } from "drizzle-orm";
import type { ParameterSet } from "@olhovivo/engine";
import { createDb, defaultDatabasePath, migrateDb } from "../client";
import { parameters2026 } from "../import/parameters2026";
import { parameterSetSchema } from "../parameterSchema";
import { parameterSets } from "../schema";
import { parameters2025 } from "../seed/parameters2025";

const BRACKETS_BY_YEAR: Record<number, ParameterSet["irs"]> = {
  2025: parameters2025.irs,
  2026: parameters2026.irs,
};

const db = createDb(defaultDatabasePath());
migrateDb(db);
for (const row of db.select().from(parameterSets).all()) {
  const data = row.data as Partial<ParameterSet>;
  const label = `${row.year} ${row.region} v${row.version} (${row.status})`;
  if (data.irs) {
    console.log(`${label}: already has IRS brackets`);
    continue;
  }
  const irs = BRACKETS_BY_YEAR[row.year];
  if (!irs) {
    console.warn(`${label}: no IRS brackets known for ${row.year}; store a new version`);
    continue;
  }
  const updated = parameterSetSchema.parse({ ...data, irs });
  db.update(parameterSets).set({ data: updated }).where(eq(parameterSets.id, row.id)).run();
  console.log(`${label}: IRS brackets added`);
}
