import type { Db } from "../client";
import { upsertReferenceRate } from "../store";
import type { ImportCounts } from "./run";

/** Reference-rate name of the yearly rent update (NRAU art. 24; Lei 6/2006). */
export const RENT_UPDATE_RATE = "rent_update";

/**
 * Rent update coefficients published by INE in the Diário da República, as rates
 * (1.0256 → 0.0256), dated 1 January of the year they apply to. A coefficient counts once its
 * notice is published (by 30 October of the year before); add new years here.
 */
export const RENT_UPDATES = [
  { year: 2024, rate: 0.0694, notice: "Aviso n.º 20980-A/2023" },
  { year: 2025, rate: 0.0216, notice: "Aviso n.º 23099/2024/2" },
  { year: 2026, rate: 0.0224, notice: "Aviso n.º 23174/2025/2" },
  { year: 2027, rate: 0.0256, notice: "Aviso n.º 24199/2026/2" },
] as const;

export async function importRentUpdates(db: Db): Promise<ImportCounts> {
  for (const { year, rate, notice } of RENT_UPDATES) {
    upsertReferenceRate(db, {
      name: RENT_UPDATE_RATE,
      date: `${year}-01-01`,
      value: rate,
      source: notice,
    });
  }
  return { seen: RENT_UPDATES.length, new: 0, updated: RENT_UPDATES.length };
}
