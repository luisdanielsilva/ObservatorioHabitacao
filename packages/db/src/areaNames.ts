import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { areas, type Area } from "./schema";

/** Lower-case, no accents, without the "União das freguesias de" prefix. */
export function normaliseAreaName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^uniao das freguesias de /, "")
    .trim();
}

/**
 * Finds a municipality by name and, within it, a parish matching one of `parishNames`
 * (also matching one part of a union of parishes, e.g. "Sé" in "Maximinos, Sé e Cividade").
 * Returns the parish, else the municipality, else undefined. Used when no boundary data
 * is available for point-in-polygon lookups.
 */
export function findAreaByNames(
  db: Db,
  municipalityName: string,
  parishNames: string[],
): Area | undefined {
  const target = normaliseAreaName(municipalityName);
  const municipality = db
    .select()
    .from(areas)
    .where(eq(areas.level, "municipality"))
    .all()
    .find((a) => normaliseAreaName(a.name) === target);
  if (!municipality) return undefined;

  const wanted = parishNames.map(normaliseAreaName);
  const parish = db
    .select()
    .from(areas)
    .where(and(eq(areas.parentId, municipality.id), eq(areas.level, "parish")))
    .all()
    .find((a) => {
      const name = normaliseAreaName(a.name);
      return wanted.some((n) => name === n || name.split(/, | e /).includes(n));
    });
  return parish ?? municipality;
}
