import type { AlRegistrationStatus, ParameterSet, Region } from "@olhovivo/engine";
import { and, asc, desc, eq, lte, max } from "drizzle-orm";
import type { Db } from "./client";
import { parameterSetSchema } from "./parameterSchema";
import {
  alIndicators,
  alRules,
  areas,
  imiRates,
  marketStats,
  parameterSets,
  type Area,
  type MarketMetric,
  type ParameterSetRow,
} from "./schema";

// ── Parameters ──────────────────────────────────────────────────────────────

/** The active parameter set for a region, for the given year or the latest year before it. */
export function getActiveParameterSet(
  db: Db,
  region: Region,
  year: number,
): ParameterSetRow | undefined {
  return db
    .select()
    .from(parameterSets)
    .where(
      and(
        eq(parameterSets.region, region),
        eq(parameterSets.status, "active"),
        lte(parameterSets.year, year),
      ),
    )
    .orderBy(desc(parameterSets.year))
    .limit(1)
    .get();
}

/** Stores a new draft version of a year's parameters, after validation. */
export function createParameterSetDraft(
  db: Db,
  data: ParameterSet,
  notes?: string,
): ParameterSetRow {
  const valid = parameterSetSchema.parse(data);
  const latest = db
    .select({ version: max(parameterSets.version) })
    .from(parameterSets)
    .where(and(eq(parameterSets.year, valid.year), eq(parameterSets.region, valid.region)))
    .get();
  return db
    .insert(parameterSets)
    .values({
      year: valid.year,
      region: valid.region,
      version: (latest?.version ?? 0) + 1,
      status: "draft",
      data: valid,
      notes,
    })
    .returning()
    .get();
}

/** Makes a version active and archives the previously active one for its year and region. */
export function activateParameterSet(db: Db, id: number): void {
  db.transaction((tx) => {
    const row = tx.select().from(parameterSets).where(eq(parameterSets.id, id)).get();
    if (!row) throw new Error(`parameter set ${id} not found`);
    tx.update(parameterSets)
      .set({ status: "archived" })
      .where(
        and(
          eq(parameterSets.year, row.year),
          eq(parameterSets.region, row.region),
          eq(parameterSets.status, "active"),
        ),
      )
      .run();
    tx.update(parameterSets).set({ status: "active" }).where(eq(parameterSets.id, id)).run();
  });
}

// ── Areas ───────────────────────────────────────────────────────────────────

export function getAreaByPath(db: Db, path: string): Area | undefined {
  return db.select().from(areas).where(eq(areas.path, path)).get();
}

export function getTopLevelAreas(db: Db): Area[] {
  return db.select().from(areas).where(eq(areas.level, "district")).orderBy(asc(areas.name)).all();
}

export function getChildAreas(db: Db, parentId: number): Area[] {
  return db.select().from(areas).where(eq(areas.parentId, parentId)).orderBy(asc(areas.name)).all();
}

/** The area followed by its parents, up to the district. */
export function getAreaLineage(db: Db, areaId: number): Area[] {
  const lineage: Area[] = [];
  let current = db.select().from(areas).where(eq(areas.id, areaId)).get();
  while (current) {
    lineage.push(current);
    const parentId: number | null = current.parentId;
    current =
      parentId === null ? undefined : db.select().from(areas).where(eq(areas.id, parentId)).get();
  }
  return lineage;
}

// ── Market data ─────────────────────────────────────────────────────────────

export function getMarketSeries(
  db: Db,
  areaId: number,
  metric: MarketMetric,
): { period: string; value: number; synthetic: boolean }[] {
  return db
    .select({
      period: marketStats.period,
      value: marketStats.value,
      synthetic: marketStats.synthetic,
    })
    .from(marketStats)
    .where(and(eq(marketStats.areaId, areaId), eq(marketStats.metric, metric)))
    .orderBy(asc(marketStats.period))
    .all();
}

/** IMI rate of the area's municipality for the year, or the latest year before it. */
export function getImiRate(
  db: Db,
  areaId: number,
  year: number,
): { rate: number; year: number; verified: boolean } | undefined {
  const municipality = getAreaLineage(db, areaId).find((a) => a.level === "municipality");
  if (!municipality) return undefined;
  return db
    .select({ rate: imiRates.rate, year: imiRates.year, verified: imiRates.verified })
    .from(imiRates)
    .where(and(eq(imiRates.areaId, municipality.id), lte(imiRates.year, year)))
    .orderBy(desc(imiRates.year))
    .limit(1)
    .get();
}

/**
 * AL registration status for an area on a date (YYYY-MM-DD). The most specific rule wins:
 * a parish rule overrides its municipality's. Returns "unknown" when no rule exists.
 */
export function getAlStatus(
  db: Db,
  areaId: number,
  onDate: string,
): { status: AlRegistrationStatus; verified: boolean; areaId: number | null } {
  for (const area of getAreaLineage(db, areaId)) {
    const rule = db
      .select()
      .from(alRules)
      .where(and(eq(alRules.areaId, area.id), lte(alRules.validFrom, onDate)))
      .orderBy(desc(alRules.validFrom))
      .limit(1)
      .get();
    if (rule) return { status: rule.status, verified: rule.verified, areaId: area.id };
  }
  return { status: "unknown", verified: false, areaId: null };
}

/**
 * Monthly ADR and occupancy (January to December) for the area or its nearest parent with
 * data, for the latest year available. Shaped for ShortTermRentalInputs.
 */
export function getAlSeasonality(
  db: Db,
  areaId: number,
):
  | { adr: number[]; occupancy: number[]; year: number; areaId: number; synthetic: boolean }
  | undefined {
  for (const area of getAreaLineage(db, areaId)) {
    const latest = db
      .select({ year: max(alIndicators.year) })
      .from(alIndicators)
      .where(eq(alIndicators.areaId, area.id))
      .get();
    if (!latest?.year) continue;
    const rows = db
      .select()
      .from(alIndicators)
      .where(and(eq(alIndicators.areaId, area.id), eq(alIndicators.year, latest.year)))
      .orderBy(asc(alIndicators.month))
      .all();
    if (rows.length !== 12) continue;
    return {
      adr: rows.map((r) => r.adr),
      occupancy: rows.map((r) => r.occupancy),
      year: latest.year,
      areaId: area.id,
      synthetic: rows.some((r) => r.synthetic),
    };
  }
  return undefined;
}
