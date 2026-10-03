import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";

export const MARKET_METRICS = [
  "sale_eur_m2_median",
  "rent_eur_m2_median",
  "listings_count",
  "days_on_market_median",
] as const;
export type MarketMetric = (typeof MARKET_METRICS)[number];

/**
 * Aggregated market statistics per area and period (e.g. "2026-Q2").
 * `synthetic` marks placeholder seed data, which the UI must label as such.
 */
export const marketStats = sqliteTable(
  "market_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    metric: text("metric", { enum: MARKET_METRICS }).notNull(),
    value: real("value").notNull(),
    sampleSize: integer("sample_size"),
    source: text("source").notNull(),
    synthetic: integer("synthetic", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("market_stats_key_idx").on(t.areaId, t.period, t.metric, t.source),
    index("market_stats_metric_period_idx").on(t.metric, t.period),
  ],
);

/** Short-term rental indicators per area and calendar month. */
export const alIndicators = sqliteTable(
  "al_indicators",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    /** Average daily rate, €. */
    adr: real("adr").notNull(),
    /** Occupancy, 0–1. */
    occupancy: real("occupancy").notNull(),
    activeListings: integer("active_listings"),
    source: text("source").notNull(),
    synthetic: integer("synthetic", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("al_indicators_key_idx").on(t.areaId, t.year, t.month, t.source)],
);

/** Whether new AL registrations are allowed in an area (matches the engine's status). */
export const alRules = sqliteTable(
  "al_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["allowed", "containment", "suspended"] }).notNull(),
    validFrom: text("valid_from").notNull(),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("al_rules_area_from_idx").on(t.areaId, t.validFrom)],
);

/** Municipal IMI rate for urban property, per year. */
export const imiRates = sqliteTable(
  "imi_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    rate: real("rate").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("imi_rates_area_year_idx").on(t.areaId, t.year)],
);
