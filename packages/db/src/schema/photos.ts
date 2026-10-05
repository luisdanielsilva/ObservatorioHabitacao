import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scenarios } from "./evaluations";

/**
 * Photos of a saved scenario's property. The image files live on disk (see the web app's
 * lib/photos); a row is deleted with its scenario, and the files with it by the caller.
 */
export const scenarioPhotos = sqliteTable(
  "scenario_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scenarioId: integer("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    /** File name on disk, inside the scenario's folder: random, never user-provided. */
    fileName: text("file_name").notNull().unique(),
    /** The name of the uploaded file, for display only. */
    originalName: text("original_name"),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("scenario_photos_scenario_idx").on(t.scenarioId, t.id)],
);
