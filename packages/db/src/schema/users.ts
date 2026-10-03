import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { listings } from "./listings";

/**
 * Users. Sessions, OAuth accounts and magic-link tokens are added with the auth library
 * (WBS 6.1); this table only holds what the rest of the schema depends on.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .default("user"),
  plan: text("plan", { enum: ["free", "premium"] })
    .notNull()
    .default("free"),
  locale: text("locale", { enum: ["pt", "en"] })
    .notNull()
    .default("pt"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** RGPD consent log: one row per change, latest row wins. */
export const consents = sqliteTable(
  "consents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["marketing", "analytics", "partners"] }).notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.purpose, t.createdAt)],
);

export const favourites = sqliteTable(
  "favourites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/** Search filters (JSON) plus optional alert rules, e.g. target yield or discount. */
export const savedSearches = sqliteTable(
  "saved_searches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: text("filters", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    alert: text("alert", { mode: "json" }).$type<{
      minGrossYield?: number;
      minDiscount?: number;
    }>(),
    frequency: text("frequency", { enum: ["off", "instant", "daily", "weekly"] })
      .notNull()
      .default("off"),
    lastRunAt: text("last_run_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

export const alertsSent = sqliteTable(
  "alerts_sent",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    savedSearchId: integer("saved_search_id")
      .notNull()
      .references(() => savedSearches.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["email", "push"] }).notNull(),
    sentAt: text("sent_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("alerts_sent_once_idx").on(t.savedSearchId, t.listingId, t.channel)],
);
