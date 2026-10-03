import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";
import { users } from "./users";

/** Property data as read from a listing page or typed by the user. */
export interface PropertyData {
  propertyType?: string;
  bedrooms?: number;
  areaM2?: number;
  condition?: string;
  askingPrice?: number;
  address?: string;
  lat?: number;
  lng?: number;
  hasGarage?: boolean;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasPool?: boolean;
  title?: string;
}

/**
 * A listing analysed in Avaliar anúncio: what the link reader extracted, what the user
 * confirmed, and where the property is. Anonymous users' analyses have no user id.
 */
export const analyses = sqliteTable(
  "analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Public identifier used in URLs, so ids cannot be enumerated. */
    publicId: text("public_id").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    url: text("url"),
    sourceDomain: text("source_domain"),
    /** Raw fields from the link reader, before the user's corrections. */
    extracted: text("extracted", { mode: "json" }).$type<PropertyData>(),
    property: text("property", { mode: "json" }).$type<PropertyData>().notNull(),
    areaId: integer("area_id").references(() => areas.id),
    lat: real("lat"),
    lng: real("lng"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("analyses_user_idx").on(t.userId, t.createdAt)],
);

/**
 * Simplified CAOP boundary of an area, as GeoJSON geometry (WGS 84). The bounding box is
 * duplicated in the `area_boundaries_rtree` virtual table (created in a custom migration),
 * which finds candidate areas for a point before the exact point-in-polygon test.
 */
export const areaBoundaries = sqliteTable("area_boundaries", {
  areaId: integer("area_id")
    .primaryKey()
    .references(() => areas.id, { onDelete: "cascade" }),
  geometry: text("geometry", { mode: "json" }).$type<GeoJSONPolygonal>().notNull(),
  minLng: real("min_lng").notNull(),
  minLat: real("min_lat").notNull(),
  maxLng: real("max_lng").notNull(),
  maxLat: real("max_lat").notNull(),
  /** e.g. "CAOP 2025". */
  source: text("source").notNull(),
});

export type GeoJSONPolygonal =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

/** Dated reference rates such as Euribor, refreshed by an import script. */
export const referenceRates = sqliteTable(
  "reference_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** e.g. "euribor_6m", "euribor_12m". */
    name: text("name").notNull(),
    /** Date the value refers to (YYYY-MM-DD); monthly averages use the first of the month. */
    date: text("date").notNull(),
    value: real("value").notNull(),
    source: text("source").notNull(),
  },
  (t) => [uniqueIndex("reference_rates_key_idx").on(t.name, t.date, t.source)],
);
