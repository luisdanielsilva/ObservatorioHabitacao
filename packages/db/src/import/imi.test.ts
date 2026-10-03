import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "../client";
import { getAreaByPath, getImiRate } from "../queries";
import { areas, imiRates } from "../schema";
import { seed } from "../seed";
import { parseImiCsv, storeImiRates } from "./imi";

const csv = readFileSync(new URL("./__fixtures__/imi-rates.csv", import.meta.url), "utf8");

describe("parseImiCsv", () => {
  it("converts percentages to fractions and skips per-parish municipalities", () => {
    const rows = parseImiCsv(csv);
    expect(rows).toHaveLength(6); // Espinho (rates per parish) is dropped
    expect(rows).toContainEqual({ code: "0303", name: "Braga", year: 2025, rate: 0.0032 });
    expect(rows).toContainEqual({ code: "1106", name: "Lisboa", year: 2023, rate: 0.003 });
  });

  it("rejects implausible rates and missing columns", () => {
    expect(() =>
      parseImiCsv("codigo,municipality,year,urban_rate_percent\n0101,Águeda,2025,3"),
    ).toThrow(/implausible/);
    expect(() => parseImiCsv("codigo,year\n0101,2025")).toThrow(/missing column/);
  });
});

describe("storeImiRates", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
    migrateDb(db);
    seed(db);
  });

  it("replaces placeholder rows and is idempotent", () => {
    const braga = getAreaByPath(db, "braga/braga")!.id;
    const first = storeImiRates(db, parseImiCsv(csv));
    expect(first).toMatchObject({ new: 4, updated: 2, unmatched: [] }); // 2025 placeholders replaced
    expect(getImiRate(db, braga, 2026)).toEqual({ rate: 0.0032, year: 2025, verified: false });

    const second = storeImiRates(db, parseImiCsv(csv));
    expect(second).toMatchObject({ new: 0, updated: 6 });
    expect(db.select().from(imiRates).where(eq(imiRates.areaId, braga)).all()).toHaveLength(3);
  });

  it("reports codes without a municipality", () => {
    expect(
      storeImiRates(db, [{ code: "9999", name: "Nowhere", year: 2025, rate: 0.003 }]).unmatched,
    ).toEqual(["9999"]);
  });

  it("matches island municipalities by name within their region", () => {
    const madeira = getAreaByPath(db, "madeira")!.id;
    const acores = getAreaByPath(db, "acores")!.id;
    const insert = (code: string, name: string, parentId: number, region: "acores" | "madeira") =>
      db
        .insert(areas)
        .values({
          code,
          name,
          level: "municipality",
          parentId,
          region,
          slug: code,
          path: `x/${code}`,
        })
        .returning()
        .get().id;
    const funchal = insert("3103", "Funchal", madeira, "madeira");
    const calhetaM = insert("3101", "Calheta", madeira, "madeira");
    const calhetaA = insert("4501", "Calheta de São Jorge", acores, "acores");
    const result = storeImiRates(db, [
      { code: "2203", name: "Funchal", year: 2025, rate: 0.003 },
      { code: "2201", name: "Calheta (Madeira)", year: 2025, rate: 0.0031 },
      { code: "1902", name: "Calheta (Açores)", year: 2025, rate: 0.0032 },
    ]);
    expect(result.unmatched).toEqual([]);
    expect(getImiRate(db, funchal, 2025)?.rate).toBe(0.003);
    expect(getImiRate(db, calhetaM, 2025)?.rate).toBe(0.0031);
    expect(getImiRate(db, calhetaA, 2025)?.rate).toBe(0.0032);
  });
});
