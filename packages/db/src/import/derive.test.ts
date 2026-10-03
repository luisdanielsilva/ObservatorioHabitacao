import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "../client";
import { getAreaByPath, getMarketSeries } from "../queries";
import { areas, marketStats } from "../schema";
import { seed } from "../seed";
import { deriveDistrictMedians, median } from "./ine";

let db: Db;
const id = (path: string) => getAreaByPath(db, path)!.id;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
  // Give the Lisboa district three municipalities with INE data for one period.
  const lisboa = id("lisboa");
  const oeiras = db
    .insert(areas)
    .values({
      level: "municipality",
      parentId: lisboa,
      name: "Oeiras",
      slug: "oeiras",
      path: "lisboa/oeiras",
      region: "continente",
    })
    .returning()
    .get();
  for (const [areaId, value] of [
    [id("lisboa/lisboa"), 5_000],
    [id("lisboa/cascais"), 4_000],
    [oeiras.id, 3_000],
  ] as const) {
    db.insert(marketStats)
      .values({ areaId, period: "2026-Q1", metric: "sale_eur_m2_median", value, source: "ine" })
      .run();
  }
});

describe("deriveDistrictMedians", () => {
  it("stores the median of municipal medians and drops the district's synthetic rows", () => {
    expect(deriveDistrictMedians(db, "sale_eur_m2_median")).toBe(1);
    expect(getMarketSeries(db, id("lisboa"), "sale_eur_m2_median")).toEqual([
      { period: "2026-Q1", value: 4_000, synthetic: false, source: "ine_derived" },
    ]);
    // Other districts and metrics keep their seed rows.
    expect(getMarketSeries(db, id("porto"), "sale_eur_m2_median").length).toBeGreaterThan(0);
    expect(getMarketSeries(db, id("lisboa"), "rent_eur_m2_median").length).toBeGreaterThan(0);
  });

  it("skips districts with fewer than three municipalities with data", () => {
    db.delete(marketStats)
      .where(and(eq(marketStats.source, "ine"), eq(marketStats.value, 3_000)))
      .run();
    expect(deriveDistrictMedians(db, "sale_eur_m2_median")).toBe(0);
  });

  it("keeps INE's own figure where it publishes one for the region", () => {
    db.insert(marketStats)
      .values({
        areaId: id("lisboa"),
        period: "2026-Q1",
        metric: "sale_eur_m2_median",
        value: 4_444,
        source: "ine",
      })
      .run();
    expect(deriveDistrictMedians(db, "sale_eur_m2_median")).toBe(0);
    expect(
      getMarketSeries(db, id("lisboa"), "sale_eur_m2_median").filter((p) => !p.synthetic),
    ).toEqual([{ period: "2026-Q1", value: 4_444, synthetic: false, source: "ine" }]);
  });

  it("is idempotent", () => {
    deriveDistrictMedians(db, "sale_eur_m2_median");
    deriveDistrictMedians(db, "sale_eur_m2_median");
    const rows = db.select().from(marketStats).where(eq(marketStats.source, "ine_derived")).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sampleSize).toBe(3);
  });
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
