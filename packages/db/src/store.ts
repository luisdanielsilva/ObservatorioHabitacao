import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Db } from "./client";
import { getAreaLineage, getMarketSeries } from "./queries";
import {
  analyses,
  areaBoundaries,
  areas,
  cache,
  jobs,
  referenceRates,
  type Area,
  type MarketMetric,
  type PropertyData,
} from "./schema";

const now = () => Math.floor(Date.now() / 1000);

// ── Cache ───────────────────────────────────────────────────────────────────

export function cacheGet<T>(db: Db, key: string): T | undefined {
  const row = db.select().from(cache).where(eq(cache.key, key)).get();
  if (!row || row.expiresAt <= now()) return undefined;
  return row.value as T;
}

export function cacheSet(db: Db, key: string, value: unknown, ttlSeconds: number): void {
  db.insert(cache)
    .values({ key, value, expiresAt: now() + ttlSeconds })
    .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt: now() + ttlSeconds } })
    .run();
}

/** Deletes expired entries; run from a scheduled job. */
export function cachePurge(db: Db): number {
  return db.delete(cache).where(lte(cache.expiresAt, now())).run().changes;
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, unknown> = {},
  options: { runAt?: number; maxAttempts?: number } = {},
): number {
  return db
    .insert(jobs)
    .values({ type, payload, runAt: options.runAt ?? now(), maxAttempts: options.maxAttempts ?? 3 })
    .returning({ id: jobs.id })
    .get().id;
}

/**
 * Claims the next due job of the given types. Jobs locked for longer than `staleAfter`
 * seconds (a crashed worker) are claimable again. Safe with several workers: the claim is a
 * single conditional UPDATE.
 */
export function claimJob(db: Db, types: string[], staleAfter = 600) {
  const t = now();
  return db
    .update(jobs)
    .set({ status: "running", lockedAt: t, attempts: sql`${jobs.attempts} + 1` })
    .where(
      eq(
        jobs.id,
        sql`(SELECT ${jobs.id} FROM ${jobs} WHERE ${inArray(jobs.type, types)} AND ${lte(jobs.runAt, t)}
          AND (${eq(jobs.status, "queued")} OR (${eq(jobs.status, "running")} AND ${lt(jobs.lockedAt, t - staleAfter)}))
          ORDER BY ${jobs.runAt} LIMIT 1)`,
      ),
    )
    .returning()
    .get();
}

export function completeJob(db: Db, id: number): void {
  db.update(jobs).set({ status: "succeeded", lockedAt: null }).where(eq(jobs.id, id)).run();
}

/** Records a failure; the job is retried with exponential backoff until maxAttempts. */
export function failJob(db: Db, id: number, error: string): void {
  const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
  if (!job) return;
  const retry = job.attempts < job.maxAttempts;
  db.update(jobs)
    .set({
      status: retry ? "queued" : "failed",
      lockedAt: null,
      lastError: error,
      runAt: retry ? now() + 60 * 2 ** job.attempts : job.runAt,
    })
    .where(eq(jobs.id, id))
    .run();
}

// ── Locating a point ────────────────────────────────────────────────────────

/**
 * The most specific area (parish, else municipality, else district) whose CAOP boundary
 * contains the point. Uses the R*Tree for candidates, then an exact test with Turf.
 */
export function findAreaByPoint(db: Db, lat: number, lng: number): Area | undefined {
  const candidates = db
    .select({ area: areas, geometry: areaBoundaries.geometry })
    .from(areaBoundaries)
    .innerJoin(areas, eq(areas.id, areaBoundaries.areaId))
    .where(
      sql`${areaBoundaries.areaId} IN (SELECT area_id FROM area_boundaries_rtree
        WHERE min_lng <= ${lng} AND max_lng >= ${lng} AND min_lat <= ${lat} AND max_lat >= ${lat})`,
    )
    .all();

  const order = { parish: 0, municipality: 1, district: 2 } as const;
  return candidates
    .filter((c) => booleanPointInPolygon([lng, lat], c.geometry))
    .map((c) => c.area)
    .sort((a, b) => order[a.level] - order[b.level])[0];
}

// ── Reference rates ─────────────────────────────────────────────────────────

export function getLatestReferenceRate(
  db: Db,
  name: string,
): { value: number; date: string; source: string } | undefined {
  return db
    .select({
      value: referenceRates.value,
      date: referenceRates.date,
      source: referenceRates.source,
    })
    .from(referenceRates)
    .where(eq(referenceRates.name, name))
    .orderBy(desc(referenceRates.date))
    .limit(1)
    .get();
}

export function upsertReferenceRate(
  db: Db,
  rate: { name: string; date: string; value: number; source: string },
): void {
  db.insert(referenceRates)
    .values(rate)
    .onConflictDoUpdate({
      target: [referenceRates.name, referenceRates.date, referenceRates.source],
      set: { value: rate.value },
    })
    .run();
}

// ── Analyses ────────────────────────────────────────────────────────────────

export function createAnalysis(
  db: Db,
  input: {
    property: PropertyData;
    extracted?: PropertyData;
    url?: string;
    areaId?: number;
    userId?: string;
  },
) {
  const domain = input.url ? new URL(input.url).hostname.replace(/^www\./, "") : null;
  return db
    .insert(analyses)
    .values({
      publicId: randomBytes(9).toString("base64url"),
      userId: input.userId ?? null,
      url: input.url ?? null,
      sourceDomain: domain,
      extracted: input.extracted ?? null,
      property: input.property,
      areaId: input.areaId ?? null,
      lat: input.property.lat ?? null,
      lng: input.property.lng ?? null,
    })
    .returning()
    .get();
}

export function getAnalysis(db: Db, publicId: string) {
  return db.select().from(analyses).where(eq(analyses.publicId, publicId)).get();
}

// ── Area tree for selectors ─────────────────────────────────────────────────

export interface AreaNode {
  id: number;
  name: string;
  path: string;
  level: Area["level"];
  children: AreaNode[];
}

/** All areas as a tree, sorted by name (pt-PT collation). */
export function getAreaTree(db: Db): AreaNode[] {
  const rows = db.select().from(areas).orderBy(asc(areas.name)).all();
  const nodes = new Map<number, AreaNode>();
  for (const r of rows) {
    nodes.set(r.id, { id: r.id, name: r.name, path: r.path, level: r.level, children: [] });
  }
  const roots: AreaNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parentId === null) roots.push(node);
    else nodes.get(r.parentId)?.children.push(node);
  }
  const collator = new Intl.Collator("pt-PT");
  const sort = (list: AreaNode[]) => {
    list.sort((a, b) => collator.compare(a.name, b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Breadcrumb names for an area, district first. */
export function getAreaBreadcrumb(db: Db, areaId: number): Pick<Area, "id" | "name" | "path">[] {
  return getAreaLineage(db, areaId)
    .reverse()
    .map(({ id, name, path }) => ({ id, name, path }));
}

// ── Market reference ────────────────────────────────────────────────────────

export interface MarketReferenceValue {
  value: number;
  period: string;
  /** Change versus the same period a year earlier, when available. */
  yearOnYear: number | null;
  synthetic: boolean;
  /** "ine", "ine_derived" (district median of municipal medians) or "seed". */
  source: string;
  areaId: number;
  areaName: string;
  level: Area["level"];
}

/**
 * Latest median for the area, or for its nearest parent that has data (a parish without INE
 * data falls back to its municipality). Used as the market reference next to user inputs.
 */
export function getMarketReference(
  db: Db,
  areaId: number,
  metric: MarketMetric,
): MarketReferenceValue | undefined {
  for (const area of getAreaLineage(db, areaId)) {
    const series = getMarketSeries(db, area.id, metric);
    const latest = series.at(-1);
    if (!latest) continue;
    // Periods are "2025" (year), "2025-Q4" (quarter) or "2025-08" (month).
    const [year, rest] = latest.period.split("-");
    const previousLabel = rest ? `${Number(year) - 1}-${rest}` : String(Number(year) - 1);
    const previous = series.find((p) => p.period === previousLabel);
    return {
      value: latest.value,
      period: latest.period,
      yearOnYear: previous ? latest.value / previous.value - 1 : null,
      synthetic: latest.synthetic,
      source: latest.source,
      areaId: area.id,
      areaName: area.name,
      level: area.level,
    };
  }
  return undefined;
}
