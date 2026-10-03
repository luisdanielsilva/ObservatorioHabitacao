import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";

export const PROPERTY_TYPES = [
  "apartamento",
  "moradia",
  "terreno",
  "loja",
  "armazem",
  "escritorio",
  "outro",
] as const;
export const CONDITIONS = ["novo", "usado", "para_recuperar"] as const;

/** Where listings come from. Only sources whose terms allow it may be ingested. */
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  kind: text("kind", { enum: ["portal", "agency", "partner", "public", "manual"] }).notNull(),
  baseUrl: text("base_url"),
  /** Terms of use reviewed and ingestion permitted (WBS 10.4). */
  permitted: integer("permitted", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** A property for sale, deduplicated across sources. */
export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id").references(() => areas.id),
    propertyType: text("property_type", { enum: PROPERTY_TYPES }).notNull(),
    /** Bedrooms: T0 = 0 … T5+ = 5 or more. */
    bedrooms: integer("bedrooms"),
    /** Useful area (área útil), m². */
    areaM2: real("area_m2"),
    condition: text("condition", { enum: CONDITIONS }),
    price: integer("price").notNull(),
    title: text("title"),
    description: text("description"),
    address: text("address"),
    lat: real("lat"),
    lng: real("lng"),
    hasGarage: integer("has_garage", { mode: "boolean" }).notNull().default(false),
    hasElevator: integer("has_elevator", { mode: "boolean" }).notNull().default(false),
    hasBalcony: integer("has_balcony", { mode: "boolean" }).notNull().default(false),
    hasPool: integer("has_pool", { mode: "boolean" }).notNull().default(false),
    energyRating: text("energy_rating"),
    yearBuilt: integer("year_built"),
    status: text("status", { enum: ["active", "sold", "withdrawn"] })
      .notNull()
      .default("active"),
    firstSeenAt: text("first_seen_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("listings_area_idx").on(t.areaId),
    index("listings_search_idx").on(t.status, t.propertyType, t.price),
  ],
);

/** The same property as published by each source. */
export const listingSources = sqliteTable(
  "listing_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    url: text("url"),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("listing_sources_external_idx").on(t.sourceId, t.externalId)],
);

export const priceHistory = sqliteTable(
  "price_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    price: integer("price").notNull(),
    observedAt: text("observed_at").notNull(),
    sourceId: integer("source_id").references(() => sources.id),
  },
  (t) => [index("price_history_listing_idx").on(t.listingId, t.observedAt)],
);

export const listingPhotos = sqliteTable(
  "listing_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    alt: text("alt"),
  },
  (t) => [index("listing_photos_listing_idx").on(t.listingId, t.position)],
);

export type Listing = typeof listings.$inferSelect;
