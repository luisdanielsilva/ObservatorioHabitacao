import type { ParameterSet } from "@observatorio-habitacao/engine";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Versioned financial and tax parameters, one engine ParameterSet per row.
 *
 * Editing creates a new version as a draft; activating it archives the previous active
 * version for the same year and region. Saved scenarios keep the id they were calculated
 * with. `data` is validated with `parameterSetSchema` on every write.
 */
export const parameterSets = sqliteTable(
  "parameter_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    year: integer("year").notNull(),
    region: text("region", { enum: ["continente", "acores", "madeira"] }).notNull(),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
    data: text("data", { mode: "json" }).$type<ParameterSet>().notNull(),
    notes: text("notes"),
    /** Who checked the figures (e.g. the tax advisor) and when; null = unverified. */
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("parameter_sets_version_idx").on(t.year, t.region, t.version),
    uniqueIndex("parameter_sets_one_active_idx")
      .on(t.year, t.region)
      .where(sql`${t.status} = 'active'`),
  ],
);

export type ParameterSetRow = typeof parameterSets.$inferSelect;
