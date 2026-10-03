import {
  type AnySQLiteColumn,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const AREA_LEVELS = ["district", "municipality", "parish"] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number];

/**
 * Administrative areas: distrito → concelho → freguesia.
 *
 * The 18 mainland districts plus the Açores and Madeira autonomous regions form the
 * top level. `code` is the official CAOP code (DI, DICO, DICOFRE) when known; seed
 * parishes have no code until the CAOP import.
 */
export const areas = sqliteTable(
  "areas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").unique(),
    level: text("level", { enum: AREA_LEVELS }).notNull(),
    parentId: integer("parent_id").references((): AnySQLiteColumn => areas.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Slug path used in URLs, e.g. "lisboa/cascais/carcavelos-e-parede". Unique, so slugs are unique per parent. */
    path: text("path").notNull().unique(),
    region: text("region", { enum: ["continente", "acores", "madeira"] }).notNull(),
    lat: real("lat"),
    lng: real("lng"),
  },
  (t) => [index("areas_parent_idx").on(t.parentId), index("areas_level_idx").on(t.level)],
);

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
