import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { analyses } from "./analyses";
import { areas } from "./areas";
import { listings } from "./listings";
import { parameterSets } from "./parameters";
import { users } from "./users";

/** A property valuation (Vender, Avaliar anúncio, listing pages). */
export const valuations = sqliteTable(
  "valuations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    listingId: integer("listing_id").references(() => listings.id, { onDelete: "set null" }),
    areaId: integer("area_id").references(() => areas.id),
    /** The property as entered: type, bedrooms, area, condition, extras. */
    input: text("input", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    low: integer("low").notNull(),
    likely: integer("likely").notNull(),
    high: integer("high").notNull(),
    eurPerM2: real("eur_per_m2").notNull(),
    monthlyRent: integer("monthly_rent"),
    /** 0–1. */
    confidence: real("confidence").notNull(),
    modelVersion: text("model_version").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("valuations_user_idx").on(t.userId)],
);

export const valuationComparables = sqliteTable(
  "valuation_comparables",
  {
    valuationId: integer("valuation_id")
      .notNull()
      .references(() => valuations.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    weight: real("weight").notNull(),
    distanceM: real("distance_m"),
  },
  (t) => [primaryKey({ columns: [t.valuationId, t.listingId] })],
);

/**
 * A saved evaluation with inputs for all four scenarios. `results` is a cache: it can be
 * recalculated from `inputs` and the parameter set at any time.
 */
export const scenarios = sqliteTable(
  "scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").references(() => listings.id, { onDelete: "set null" }),
    analysisId: integer("analysis_id").references(() => analyses.id, { onDelete: "set null" }),
    /** Set when the user shares the scenario; gives access to its public page. */
    shareToken: text("share_token").unique(),
    /** Whether the shared page and its PDF show the property's photos (the owner opts in). */
    sharePhotos: integer("share_photos", { mode: "boolean" }).notNull().default(false),
    duplicatedFromId: integer("duplicated_from_id").references(
      (): AnySQLiteColumn => scenarios.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    /** Snapshot of the property, so the scenario survives listing changes. */
    property: text("property", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    inputs: text("inputs", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    parameterSetId: integer("parameter_set_id")
      .notNull()
      .references(() => parameterSets.id),
    results: text("results", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("scenarios_user_idx").on(t.userId, t.updatedAt)],
);
