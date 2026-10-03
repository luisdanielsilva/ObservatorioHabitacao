/**
 * Stores reviewed parameter sets as DRAFTS (never activates them):
 * - 2026 mainland, from the official consolidated codes (src/import/parameters2026.ts);
 * - a corrected 2025 mainland set (secondary-housing IMT table fixed).
 * Activation is a separate, deliberate step after a tax advisor's review.
 * Skips a set whose data is identical to an existing version of the same year and region.
 */
import { createDb, defaultDatabasePath, migrateDb } from "../client";
import { PARAMETERS_2026_NOTES, parameters2026, storeDraftIfNew } from "../import/parameters2026";
import { parameters2025 } from "../seed/parameters2025";

const db = createDb(defaultDatabasePath());
migrateDb(db);
for (const [data, notes] of [
  [parameters2026, PARAMETERS_2026_NOTES],
  [
    parameters2025,
    "Correction of the 2025 seed: secondary-housing IMT 8 % bracket ends at 621 501 € (was 648 022 €), per CIMT art. 17 n.º 1 c) as in force until December 2025. Not yet reviewed by a tax advisor.",
  ],
] as const) {
  const { created, row } = storeDraftIfNew(db, data, notes);
  console.log(
    `${data.year} ${data.region}: ${created ? "new draft" : "unchanged, existing"} version ${row.version} (${row.status})`,
  );
}
