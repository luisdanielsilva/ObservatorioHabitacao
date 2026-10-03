import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getDashboardStats,
  getLead,
  jobsSummary,
  listLeads,
  listParameterSets,
  listSources,
  listUsers,
  logEvent,
  setUserPlan,
  setUserRole,
  updateLead,
  updateSource,
  verifyParameterSet,
} from "./admin";
import { createDb, migrateDb, type Db } from "./client";
import { getAreaByPath } from "./queries";
import { createScenario } from "./scenarios";
import { ingestionJobs, leads, parameterSets, users } from "./schema";
import { seed } from "./seed";
import { enqueueJob } from "./store";

let db: Db;
const id = (path: string) => getAreaByPath(db, path)!.id;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
  db.insert(users)
    .values([
      { id: "boss", email: "boss@olhovivo.pt", role: "admin" },
      { id: "ana", email: "ana@example.pt", name: "Ana_Silva" },
      { id: "old", email: "old@example.pt", createdAt: "2020-01-01 00:00:00" },
    ])
    .run();
  db.insert(leads)
    .values([
      { type: "sales_support", name: "A", contactConsent: true, areaId: id("lisboa/cascais") },
      {
        type: "sales_support",
        name: "B",
        contactConsent: true,
        areaId: id("lisboa/lisboa/arroios"),
      },
      { type: "valuation", name: "C", contactConsent: true, status: "won", areaId: id("porto") },
      { type: "sales_support", name: "D", contactConsent: true },
    ])
    .run();
});

describe("dashboard", () => {
  it("counts users, scenarios, leads by status and district, events and imports", () => {
    createScenario(db, "ana", {
      name: "S",
      property: {},
      inputs: {},
      results: null,
      parameterSetId: db.select().from(parameterSets).get()!.id,
    });
    logEvent(db, "scenario_run", { kind: "flip" });
    logEvent(db, "scenario_run");
    logEvent(db, "search");
    db.insert(ingestionJobs)
      .values([
        { kind: "ine", status: "succeeded", finishedAt: "2026-10-01 10:00:00" },
        { kind: "caop", status: "failed", error: "timeout" },
      ])
      .run();

    const stats = getDashboardStats(db, new Date("2026-10-03T12:00:00Z"));
    expect(stats.users).toEqual({ total: 3, last30Days: 2, admins: 1, premium: 0 });
    expect(stats.scenarios).toEqual({ total: 1, shared: 0 });
    expect(stats.leadsByStatus).toMatchObject({ new: 3, won: 1, lost: 0 });
    expect(stats.leadsByDistrict).toEqual([
      { district: "Lisboa", count: 2 },
      { district: "Porto", count: 1 },
      { district: "—", count: 1 },
    ]);
    expect(stats.eventsByType[0]).toEqual({ type: "scenario_run", count: 2 });
    expect(stats.lastImport).toMatchObject({ kind: "caop", status: "failed" });
    expect(stats.importJobs).toHaveLength(2);
  });
});

describe("leads", () => {
  it("filters by status and type", () => {
    expect(listLeads(db)).toHaveLength(4);
    expect(listLeads(db, { status: "won" }).map((l) => l.name)).toEqual(["C"]);
    expect(listLeads(db, { type: "sales_support" })).toHaveLength(3);
    expect(listLeads(db, { type: "valuation", status: "new" })).toHaveLength(0);
  });

  it("updates status, notes and assignee (admins only)", () => {
    const lead = listLeads(db).find((l) => l.name === "A")!;
    expect(
      updateLead(db, lead.id, { status: "contacted", notes: "Ligou", assigneeId: "boss" }),
    ).toBe(true);
    expect(getLead(db, lead.id)).toMatchObject({
      lead: { status: "contacted", notes: "Ligou", assigneeId: "boss" },
      areaName: "Cascais",
    });
    expect(updateLead(db, lead.id, { assigneeId: "ana" })).toBe(false);
    expect(updateLead(db, 999, { status: "won" })).toBe(false);
  });
});

describe("parameter sets", () => {
  it("lists sets and records verification", () => {
    const [set] = listParameterSets(db);
    expect(set).toMatchObject({ year: 2025, status: "active", verifiedBy: null });
    expect(verifyParameterSet(db, set!.id, "  ")).toBe(false);
    expect(verifyParameterSet(db, set!.id, "Dra. Contabilista")).toBe(true);
    const verified = db.select().from(parameterSets).where(eq(parameterSets.id, set!.id)).get()!;
    expect(verified.verifiedBy).toBe("Dra. Contabilista");
    expect(verified.verifiedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  });
});

describe("sources and jobs", () => {
  it("toggles sources and summarises the job queue", () => {
    const [source] = listSources(db);
    expect(updateSource(db, source!.id, { active: false, permitted: false })).toBe(true);
    expect(listSources(db)[0]).toMatchObject({ active: false, permitted: false });
    enqueueJob(db, "alerts");
    enqueueJob(db, "alerts");
    expect(jobsSummary(db)).toEqual([{ type: "alerts", status: "queued", count: 2 }]);
  });
});

describe("users", () => {
  it("searches by email or name, treating wildcards literally", () => {
    expect(
      listUsers(db, "example")
        .map((u) => u.id)
        .sort(),
    ).toEqual(["ana", "old"]);
    expect(listUsers(db, "_").map((u) => u.id)).toEqual(["ana"]);
    expect(listUsers(db, "%")).toEqual([]);
    expect(listUsers(db)).toHaveLength(3);
  });

  it("changes roles and plans, but never removes your own admin role", () => {
    expect(setUserRole(db, "boss", "ana", "admin")).toBe(true);
    expect(setUserRole(db, "boss", "boss", "user")).toBe(false);
    expect(setUserPlan(db, "ana", "premium")).toBe(true);
    expect(db.select().from(users).where(eq(users.id, "ana")).get()).toMatchObject({
      role: "admin",
      plan: "premium",
    });
    expect(db.select().from(users).where(eq(users.id, "boss")).get()?.role).toBe("admin");
  });
});
