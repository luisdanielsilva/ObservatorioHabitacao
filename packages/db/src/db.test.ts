import { runShortTermRental, type ParameterSet } from "@olhovivo/engine";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "./client";
import {
  activateParameterSet,
  createParameterSetDraft,
  getActiveParameterSet,
  getAlSeasonality,
  getAlStatus,
  getAreaByPath,
  getAreaLineage,
  getChildAreas,
  getImiRate,
  getMarketSeries,
  getTopLevelAreas,
} from "./queries";
import { marketStats, parameterSets } from "./schema";
import { seed, slugify } from "./seed";
import { parameters2025 } from "./seed/parameters2025";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
});

const areaId = (path: string) => {
  const area = getAreaByPath(db, path);
  if (!area) throw new Error(`no area ${path}`);
  return area.id;
};

describe("seed", () => {
  it("creates the 18 districts plus Açores and Madeira", () => {
    const top = getTopLevelAreas(db);
    expect(top).toHaveLength(20);
    expect(top.filter((a) => a.region === "continente")).toHaveLength(18);
    expect(top.map((a) => a.slug)).toContain("acores");
  });

  it("builds the district → municipality → parish hierarchy", () => {
    const lineage = getAreaLineage(db, areaId("lisboa/cascais/carcavelos-e-parede"));
    expect(lineage.map((a) => [a.level, a.name])).toEqual([
      ["parish", "Carcavelos e Parede"],
      ["municipality", "Cascais"],
      ["district", "Lisboa"],
    ]);
    expect(getChildAreas(db, areaId("lisboa")).map((a) => a.code)).toEqual(["1105", "1106"]);
  });

  it("marks market data as synthetic and ends at the latest value", () => {
    const series = getMarketSeries(db, areaId("porto/porto"), "rent_eur_m2_median");
    expect(series).toHaveLength(12);
    expect(series.at(-1)).toEqual({ period: "2026-Q2", value: 15.5, synthetic: true });
    expect(series.every((p) => p.synthetic)).toBe(true);
  });

  it("refuses to seed twice", () => {
    expect(() => seed(db)).toThrow("already seeded");
  });

  it("enforces foreign keys", () => {
    expect(() =>
      db
        .insert(marketStats)
        .values({
          areaId: 99_999,
          period: "2026-Q2",
          metric: "sale_eur_m2_median",
          value: 1,
          source: "x",
        })
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("slugify", () => {
  it("removes accents and punctuation", () => {
    expect(slugify("Cedofeita, Santo Ildefonso, Sé")).toBe("cedofeita-santo-ildefonso-se");
    expect(slugify("Évora")).toBe("evora");
  });
});

describe("parameter sets", () => {
  it("serves the latest active year up to the requested one", () => {
    expect(getActiveParameterSet(db, "continente", 2026)?.year).toBe(2025);
    expect(getActiveParameterSet(db, "continente", 2024)).toBeUndefined();
    expect(getActiveParameterSet(db, "madeira", 2026)).toBeUndefined();
  });

  it("versions drafts and keeps one active set per year and region", () => {
    const changed: ParameterSet = { ...parameters2025, vatRate: 0.22 };
    const draft = createParameterSetDraft(db, changed);
    expect(draft).toMatchObject({ version: 2, status: "draft" });
    expect(getActiveParameterSet(db, "continente", 2025)?.data.vatRate).toBe(0.23);

    activateParameterSet(db, draft.id);
    expect(getActiveParameterSet(db, "continente", 2025)?.data.vatRate).toBe(0.22);
    const statuses = db.select({ s: parameterSets.status }).from(parameterSets).all();
    expect(statuses.map((r) => r.s).sort()).toEqual(["active", "archived"]);
  });

  it("rejects invalid parameters", () => {
    const noOpenBracket = {
      ...parameters2025,
      imt: { ...parameters2025.imt, hpp: [{ upTo: 100_000, rate: 0, deduction: 0 }] },
    };
    expect(() => createParameterSetDraft(db, noOpenBracket)).toThrow(/open-ended/);
    expect(() => createParameterSetDraft(db, { ...parameters2025, vatRate: 23 })).toThrow();
  });

  it("does not allow two active sets for the same year", () => {
    const draft = createParameterSetDraft(db, parameters2025);
    expect(() =>
      db
        .update(parameterSets)
        .set({ status: "active" })
        .where(eq(parameterSets.id, draft.id))
        .run(),
    ).toThrow(/UNIQUE/);
  });
});

describe("area lookups", () => {
  it("finds the IMI rate through the parish's municipality", () => {
    expect(getImiRate(db, areaId("braga/braga/sao-vicente"), 2026)).toEqual({
      rate: 0.0035,
      year: 2025,
      verified: false,
    });
    expect(getImiRate(db, areaId("braga"), 2026)).toBeUndefined();
  });

  it("applies the most specific AL rule", () => {
    const status = (path: string) => getAlStatus(db, areaId(path), "2026-10-03").status;
    expect(status("lisboa/lisboa/santa-maria-maior")).toBe("suspended");
    expect(status("lisboa/lisboa/arroios")).toBe("containment");
    expect(status("lisboa/cascais/alcabideche")).toBe("allowed");
    expect(status("aveiro")).toBe("unknown");
    expect(getAlStatus(db, areaId("lisboa/lisboa"), "2024-12-31").status).toBe("unknown");
  });

  it("returns monthly AL seasonality from the nearest area with data", () => {
    const season = getAlSeasonality(db, areaId("porto/porto/bonfim"));
    expect(season?.areaId).toBe(areaId("porto/porto"));
    expect(season?.adr).toHaveLength(12);
    expect(Math.max(...season!.adr)).toBe(135);
    expect(getAlSeasonality(db, areaId("aveiro"))).toBeUndefined();
  });
});

describe("engine with database data", () => {
  it("runs a short-term rental from seeded parameters, IMI, AL rules and seasonality", () => {
    const parish = areaId("lisboa/cascais/cascais-e-estoril");
    const params = getActiveParameterSet(db, "continente", 2026)!.data;
    const season = getAlSeasonality(db, parish)!;

    const result = runShortTermRental(
      {
        purchasePrice: 400_000,
        propertyUse: "secondary",
        imiRate: getImiRate(db, parish, 2026)!.rate,
        renovationBudget: 0,
        renovationMonths: 0,
        loan: { amount: 280_000, annualRate: 0.034, termYears: 30 },
        holdingMonths: 60,
        exitPrice: 460_000,
        sellingCommissionRate: 0.05,
        marginalTaxRate: 0.37,
        condominiumMonthly: 60,
        insuranceAnnual: 300,
        adr: season.adr,
        occupancy: season.occupancy,
        adrGrowthRate: 0.02,
        startMonth: 1,
        averageStayNights: 3,
        cleaningFeePerStay: 40,
        cleaningCostPerStay: 35,
        platformFeeRate: 0.15,
        managementRate: 0.2,
        utilitiesMonthly: 120,
        consumablesPerNight: 4,
        furnishingCost: 15_000,
        registrationCost: 1_000,
        alStatus: getAlStatus(db, parish, "2026-10-03").status,
        vatRegistered: true,
      },
      params,
    );

    expect(result.viable).toBe(true);
    // IMT 400 000 × 8 % − 12 450.89 = 19 549.11
    expect(result.acquisition?.imt).toBe(19_549.11);
    expect(result.months).toHaveLength(61);
    expect(result.grossYield).toBeGreaterThan(0);
  });
});
