import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";
import { sources } from "./listings";
import { users } from "./users";

/** Requests for valuation, sales support, negotiation or partner services. */
export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", {
      enum: ["valuation", "sales_support", "negotiation", "partner"],
    }).notNull(),
    status: text("status", { enum: ["new", "contacted", "qualified", "won", "lost"] })
      .notNull()
      .default("new"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    areaId: integer("area_id").references(() => areas.id),
    message: text("message"),
    /** Related valuation, listing or scenario details. */
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    /** The person agreed to be contacted (RGPD). */
    contactConsent: integer("contact_consent", { mode: "boolean" }).notNull(),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("leads_status_idx").on(t.status, t.createdAt)],
);

export const ingestionJobs = sqliteTable(
  "ingestion_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id").references(() => sources.id),
    kind: text("kind").notNull(),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed"] })
      .notNull()
      .default("queued"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    itemsSeen: integer("items_seen").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
    itemsUpdated: integer("items_updated").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("ingestion_jobs_source_idx").on(t.sourceId, t.startedAt)],
);

/** Product analytics events (searches, scenarios run, alerts sent). */
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    areaId: integer("area_id").references(() => areas.id),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("events_type_idx").on(t.type, t.createdAt)],
);
