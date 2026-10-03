import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type Db } from "./client";
import { getAreaByPath } from "./queries";
import { areaBoundaries, jobs, type GeoJSONPolygonal } from "./schema";
import { seed } from "./seed";
import {
  cacheGet,
  cachePurge,
  cacheSet,
  claimJob,
  completeJob,
  createAnalysis,
  enqueueJob,
  failJob,
  findAreaByPoint,
  getAnalysis,
  getAreaBreadcrumb,
  getAreaTree,
  getLatestReferenceRate,
  getMarketReference,
  upsertReferenceRate,
} from "./store";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
});

const id = (path: string) => getAreaByPath(db, path)!.id;

describe("cache", () => {
  it("returns values until they expire", () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T12:00:00Z") });
    cacheSet(db, "k", { a: 1 }, 60);
    expect(cacheGet(db, "k")).toEqual({ a: 1 });
    cacheSet(db, "k", { a: 2 }, 60);
    expect(cacheGet(db, "k")).toEqual({ a: 2 });

    vi.setSystemTime(new Date("2026-10-03T12:01:01Z"));
    expect(cacheGet(db, "k")).toBeUndefined();
    expect(cachePurge(db)).toBe(1);
    vi.useRealTimers();
  });
});

describe("jobs", () => {
  it("claims due jobs once and completes them", () => {
    const jobId = enqueueJob(db, "import-ine", { metric: "sale" });
    enqueueJob(db, "import-ine", {}, { runAt: Math.floor(Date.now() / 1000) + 3600 });

    const claimed = claimJob(db, ["import-ine"]);
    expect(claimed?.id).toBe(jobId);
    expect(claimed?.attempts).toBe(1);
    expect(claimJob(db, ["import-ine"])).toBeUndefined(); // the other one is not due
    expect(claimJob(db, ["other"])).toBeUndefined();

    completeJob(db, jobId);
    expect(db.select().from(jobs).where(eq(jobs.id, jobId)).get()?.status).toBe("succeeded");
  });

  it("retries failures with backoff, then gives up", () => {
    const jobId = enqueueJob(db, "x", {}, { maxAttempts: 2 });
    claimJob(db, ["x"]);
    failJob(db, jobId, "boom");
    const retried = db.select().from(jobs).where(eq(jobs.id, jobId)).get()!;
    expect(retried.status).toBe("queued");
    expect(retried.runAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    db.update(jobs).set({ runAt: 0 }).where(eq(jobs.id, jobId)).run();
    claimJob(db, ["x"]);
    failJob(db, jobId, "boom again");
    const failed = db.select().from(jobs).where(eq(jobs.id, jobId)).get()!;
    expect(failed).toMatchObject({ status: "failed", attempts: 2, lastError: "boom again" });
  });
});

describe("findAreaByPoint", () => {
  const square = (lng: number, lat: number, size: number): GeoJSONPolygonal => ({
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + size, lat],
        [lng + size, lat + size],
        [lng, lat + size],
        [lng, lat],
      ],
    ],
  });
  const addBoundary = (path: string, geometry: GeoJSONPolygonal & { type: "Polygon" }) => {
    const ring = geometry.coordinates[0]!;
    const lngs = ring.map((p) => p[0]!);
    const lats = ring.map((p) => p[1]!);
    db.insert(areaBoundaries)
      .values({
        areaId: id(path),
        geometry,
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        source: "test",
      })
      .run();
  };

  beforeEach(() => {
    addBoundary("lisboa", square(-9.5, 38.6, 0.5) as GeoJSONPolygonal & { type: "Polygon" });
    addBoundary(
      "lisboa/lisboa",
      square(-9.25, 38.7, 0.15) as GeoJSONPolygonal & { type: "Polygon" },
    );
    addBoundary(
      "lisboa/lisboa/arroios",
      square(-9.14, 38.72, 0.02) as GeoJSONPolygonal & { type: "Polygon" },
    );
  });

  it("returns the most specific area containing the point", () => {
    expect(findAreaByPoint(db, 38.73, -9.13)?.path).toBe("lisboa/lisboa/arroios");
    expect(findAreaByPoint(db, 38.75, -9.2)?.path).toBe("lisboa/lisboa");
    expect(findAreaByPoint(db, 38.65, -9.45)?.path).toBe("lisboa");
    expect(findAreaByPoint(db, 41.15, -8.6)).toBeUndefined();
  });

  it("keeps the R*Tree in sync when boundaries change", () => {
    db.delete(areaBoundaries)
      .where(eq(areaBoundaries.areaId, id("lisboa/lisboa/arroios")))
      .run();
    expect(findAreaByPoint(db, 38.73, -9.13)?.path).toBe("lisboa/lisboa");
  });
});

describe("reference rates", () => {
  it("returns the latest value and upserts by name, date and source", () => {
    upsertReferenceRate(db, {
      name: "euribor_12m",
      date: "2026-08-01",
      value: 0.021,
      source: "ecb",
    });
    upsertReferenceRate(db, {
      name: "euribor_12m",
      date: "2026-09-01",
      value: 0.022,
      source: "ecb",
    });
    upsertReferenceRate(db, {
      name: "euribor_12m",
      date: "2026-09-01",
      value: 0.0225,
      source: "ecb",
    });
    expect(getLatestReferenceRate(db, "euribor_12m")).toEqual({
      value: 0.0225,
      date: "2026-09-01",
      source: "ecb",
    });
    expect(getLatestReferenceRate(db, "euribor_6m")).toBeUndefined();
  });
});

describe("analyses", () => {
  it("stores property data under an unguessable public id", () => {
    const created = createAnalysis(db, {
      url: "https://www.example.pt/imovel/123",
      property: { askingPrice: 250_000, areaM2: 70 },
      areaId: id("porto/porto/bonfim"),
    });
    expect(created.publicId).toMatch(/^[\w-]{12}$/);
    expect(created.sourceDomain).toBe("example.pt");
    expect(getAnalysis(db, created.publicId)?.property).toEqual({
      askingPrice: 250_000,
      areaM2: 70,
    });
  });
});

describe("area helpers", () => {
  it("builds a sorted tree", () => {
    const tree = getAreaTree(db);
    expect(tree).toHaveLength(20);
    expect(tree[0]!.name).toBe("Açores");
    const lisboa = tree.find((n) => n.path === "lisboa")!;
    expect(lisboa.children.map((c) => c.name)).toEqual(["Cascais", "Lisboa"]);
  });

  it("builds breadcrumbs from the district down", () => {
    expect(getAreaBreadcrumb(db, id("porto/porto/bonfim")).map((a) => a.name)).toEqual([
      "Porto",
      "Porto",
      "Bonfim",
    ]);
  });

  it("finds the market reference with year-on-year change", () => {
    const ref = getMarketReference(db, id("lisboa/lisboa/arroios"), "sale_eur_m2_median")!;
    expect(ref).toMatchObject({
      value: 5_300,
      period: "2026-Q2",
      level: "parish",
      synthetic: true,
    });
    expect(ref.yearOnYear).toBeGreaterThan(0.03);
  });
});
