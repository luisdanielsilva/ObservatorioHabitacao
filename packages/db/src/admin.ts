import { and, asc, count, desc, eq, gte, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  analyses,
  areas,
  events,
  ingestionJobs,
  jobs,
  leads,
  parameterSets,
  scenarios,
  sources,
  users,
} from "./schema";

/**
 * Data functions for the admin back-office (WBS 8). Callers must check that the user is an
 * admin before calling them.
 */

type LeadStatus = (typeof leads.$inferSelect)["status"];
type LeadType = (typeof leads.$inferSelect)["type"];

const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);

// ── Analytics (8.6) ─────────────────────────────────────────────────────────

/** Records an analytics event (searches, scenarios run, alerts sent…). */
export function logEvent(
  db: Db,
  type: string,
  payload: Record<string, unknown> | null = null,
  userId: string | null = null,
  areaId: number | null = null,
): void {
  db.insert(events).values({ type, payload, userId, areaId }).run();
}

export interface DashboardStats {
  users: { total: number; last30Days: number; admins: number; premium: number };
  scenarios: { total: number; shared: number };
  analyses: number;
  leadsByStatus: Record<LeadStatus, number>;
  /** District name → number of leads; leads without an area count as "—". */
  leadsByDistrict: { district: string; count: number }[];
  eventsByType: { type: string; count: number }[];
  importJobs: { status: string; count: number }[];
  lastImport: { kind: string; status: string; finishedAt: string | null } | null;
}

export function getDashboardStats(db: Db, today = new Date()): DashboardStats {
  const since = new Date(today.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const n = (q: { n: number } | undefined) => q?.n ?? 0;

  const leadsByStatus: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  };
  for (const r of db
    .select({ status: leads.status, n: count() })
    .from(leads)
    .groupBy(leads.status)
    .all()) {
    leadsByStatus[r.status] = r.n;
  }

  // Leads by district: walk each lead's area up to its district.
  const areaRows = db
    .select({ id: areas.id, parentId: areas.parentId, name: areas.name, level: areas.level })
    .from(areas)
    .all();
  const byId = new Map(areaRows.map((a) => [a.id, a]));
  const districtOf = (areaId: number | null): string => {
    let a = areaId === null ? undefined : byId.get(areaId);
    while (a && a.level !== "district") a = a.parentId === null ? undefined : byId.get(a.parentId);
    return a?.name ?? "—";
  };
  const districtCounts = new Map<string, number>();
  for (const r of db
    .select({ areaId: leads.areaId, n: count() })
    .from(leads)
    .groupBy(leads.areaId)
    .all()) {
    const d = districtOf(r.areaId);
    districtCounts.set(d, (districtCounts.get(d) ?? 0) + r.n);
  }

  const last = db
    .select({
      kind: ingestionJobs.kind,
      status: ingestionJobs.status,
      finishedAt: ingestionJobs.finishedAt,
    })
    .from(ingestionJobs)
    .orderBy(desc(ingestionJobs.id))
    .limit(1)
    .get();

  return {
    users: {
      total: n(db.select({ n: count() }).from(users).get()),
      last30Days: n(db.select({ n: count() }).from(users).where(gte(users.createdAt, since)).get()),
      admins: n(db.select({ n: count() }).from(users).where(eq(users.role, "admin")).get()),
      premium: n(db.select({ n: count() }).from(users).where(eq(users.plan, "premium")).get()),
    },
    scenarios: {
      total: n(db.select({ n: count() }).from(scenarios).get()),
      shared: n(
        db
          .select({ n: count() })
          .from(scenarios)
          .where(sql`${scenarios.shareToken} IS NOT NULL`)
          .get(),
      ),
    },
    analyses: n(db.select({ n: count() }).from(analyses).get()),
    leadsByStatus,
    leadsByDistrict: [...districtCounts]
      .map(([district, c]) => ({ district, count: c }))
      // Most leads first; ties by name, with leads without an area ("—") last.
      .sort(
        (a, b) =>
          b.count - a.count ||
          Number(a.district === "—") - Number(b.district === "—") ||
          a.district.localeCompare(b.district, "pt"),
      ),
    eventsByType: db
      .select({ type: events.type, count: count() })
      .from(events)
      .groupBy(events.type)
      .orderBy(desc(count()))
      .all(),
    importJobs: db
      .select({ status: ingestionJobs.status, count: count() })
      .from(ingestionJobs)
      .groupBy(ingestionJobs.status)
      .all(),
    lastImport: last ?? null,
  };
}

// ── Parameters (8.3) ────────────────────────────────────────────────────────

export function listParameterSets(db: Db) {
  return db
    .select({
      id: parameterSets.id,
      year: parameterSets.year,
      region: parameterSets.region,
      version: parameterSets.version,
      status: parameterSets.status,
      notes: parameterSets.notes,
      verifiedBy: parameterSets.verifiedBy,
      verifiedAt: parameterSets.verifiedAt,
      createdAt: parameterSets.createdAt,
    })
    .from(parameterSets)
    .orderBy(desc(parameterSets.year), asc(parameterSets.region), desc(parameterSets.version))
    .all();
}

export function getParameterSetById(db: Db, id: number) {
  return db.select().from(parameterSets).where(eq(parameterSets.id, id)).get();
}

/** Records who checked a parameter set (e.g. the tax advisor) and when. */
export function verifyParameterSet(db: Db, id: number, verifiedBy: string): boolean {
  const name = verifiedBy.trim().slice(0, 120);
  if (!name) return false;
  return (
    db
      .update(parameterSets)
      .set({ verifiedBy: name, verifiedAt: now() })
      .where(eq(parameterSets.id, id))
      .run().changes > 0
  );
}

// ── Leads / CRM (8.4) ───────────────────────────────────────────────────────

export function listLeads(db: Db, filter: { status?: LeadStatus; type?: LeadType } = {}) {
  const conditions = [
    filter.status ? eq(leads.status, filter.status) : undefined,
    filter.type ? eq(leads.type, filter.type) : undefined,
  ].filter((c) => c !== undefined);
  return db
    .select({
      id: leads.id,
      type: leads.type,
      status: leads.status,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      areaName: areas.name,
      assigneeId: leads.assigneeId,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(areas, eq(areas.id, leads.areaId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(500)
    .all();
}

export function getLead(db: Db, id: number) {
  return db
    .select({ lead: leads, areaName: areas.name, areaPath: areas.path })
    .from(leads)
    .leftJoin(areas, eq(areas.id, leads.areaId))
    .where(eq(leads.id, id))
    .get();
}

export function updateLead(
  db: Db,
  id: number,
  update: { status?: LeadStatus; notes?: string | null; assigneeId?: string | null },
): boolean {
  if (update.assigneeId) {
    const assignee = db.select().from(users).where(eq(users.id, update.assigneeId)).get();
    if (assignee?.role !== "admin") return false;
  }
  return (
    db
      .update(leads)
      .set({
        ...update,
        notes: update.notes === undefined ? undefined : (update.notes?.slice(0, 5000) ?? null),
        updatedAt: now(),
      })
      .where(eq(leads.id, id))
      .run().changes > 0
  );
}

export function listAdmins(db: Db) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.email))
    .all();
}

// ── Imports and sources (8.1, 8.2) ──────────────────────────────────────────

export function listIngestionJobs(db: Db, limit = 50) {
  return db
    .select({ job: ingestionJobs, sourceName: sources.name })
    .from(ingestionJobs)
    .leftJoin(sources, eq(sources.id, ingestionJobs.sourceId))
    .orderBy(desc(ingestionJobs.id))
    .limit(limit)
    .all();
}

export function listSources(db: Db) {
  return db.select().from(sources).orderBy(asc(sources.name)).all();
}

export function updateSource(
  db: Db,
  id: number,
  update: { active?: boolean; permitted?: boolean },
): boolean {
  return db.update(sources).set(update).where(eq(sources.id, id)).run().changes > 0;
}

/** Background job queue summary: count per type and status. */
export function jobsSummary(db: Db) {
  return db
    .select({ type: jobs.type, status: jobs.status, count: count() })
    .from(jobs)
    .groupBy(jobs.type, jobs.status)
    .orderBy(asc(jobs.type), asc(jobs.status))
    .all();
}

// ── Users (8.5) ─────────────────────────────────────────────────────────────

export function listUsers(db: Db, search = "") {
  const q = search.trim().slice(0, 100);
  // Escape LIKE wildcards so a search for "_" or "%" matches them literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const matches = (column: typeof users.email | typeof users.name) =>
    sql`${column} LIKE ${pattern} ESCAPE '\\'`;
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      plan: users.plan,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(q ? or(matches(users.email), matches(users.name)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200)
    .all();
}

/**
 * Changes a user's role. An admin cannot remove their own admin role, so the back-office can
 * never be left without the person changing it.
 */
export function setUserRole(
  db: Db,
  actingUserId: string,
  userId: string,
  role: "user" | "admin",
): boolean {
  if (userId === actingUserId && role !== "admin") return false;
  return db.update(users).set({ role }).where(eq(users.id, userId)).run().changes > 0;
}

export function setUserPlan(db: Db, userId: string, plan: "free" | "premium"): boolean {
  return db.update(users).set({ plan }).where(eq(users.id, userId)).run().changes > 0;
}
