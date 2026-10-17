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
 * Users. The id, name, email, emailVerified and image columns follow the Auth.js adapter
 * schema (WBS 6.1); role, plan and locale are Observatório Habitação's own. Phone and birth
 * date are optional (issue #7, given with consent); profileCompletedAt is set when the user
 * fills in the profile after their first sign-in, which saving and PDFs require.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
  phone: text("phone"),
  /** YYYY-MM-DD. */
  birthDate: text("birth_date"),
  profileCompletedAt: text("profile_completed_at"),
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

// ── Auth.js adapter tables ──────────────────────────────────────────────────

/** OAuth accounts linked to a user (e.g. Google). Property names follow Auth.js. */
export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_idx").on(t.userId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-time tokens for email magic links. */
export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
