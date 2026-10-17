import { imt } from "@observatorio-habitacao/engine";
import { describe, expect, it } from "vitest";
import { createDb, migrateDb } from "../client";
import { parameterSetSchema } from "../parameterSchema";
import { getActiveParameterSet } from "../queries";
import { seed } from "../seed";
import { parameters2025 } from "../seed/parameters2025";
import { imtTable, parameters2026, storeDraftIfNew } from "./parameters2026";

describe("imtTable", () => {
  it("derives the deductions from limits and marginal rates", () => {
    expect(parameters2026.imt.hpp.map((b) => b.deduction)).toEqual([
      0, 2_126.92, 6_491.02, 10_457.96, 13_763.35, 0, 0,
    ]);
    expect(parameters2026.imt.secondary.map((b) => b.deduction)).toEqual([
      0, 1_063.46, 5_427.56, 9_394.5, 12_699.89, 0, 0,
    ]);
  });

  it("reproduces the average rates published in CIMT art. 17 for 2026", () => {
    const average = (value: number, use: "hpp" | "secondary") =>
      (imt(value, use, parameters2026) / value) * 100;
    // Published to four decimals; the law rounds, so allow one unit in the last place.
    for (const [value, use, published] of [
      [145_470, "hpp", 0.5379],
      [198_347, "hpp", 1.7274],
      [330_539, "hpp", 3.8361],
      [145_470, "secondary", 1.2689],
      [198_347, "secondary", 2.2636],
      [330_539, "secondary", 4.1578],
    ] as const) {
      expect(Math.abs(average(value, use) - published)).toBeLessThanOrEqual(0.0001);
    }
  });

  it("handles a table without progressive brackets", () => {
    expect(imtTable([], [{ upTo: null, rate: 0.065 }])).toEqual([
      { upTo: null, rate: 0.065, deduction: 0 },
    ]);
  });
});

describe("parameter sets", () => {
  it("2026 passes validation", () => {
    expect(() => parameterSetSchema.parse(parameters2026)).not.toThrow();
  });

  it("2025 secondary housing switches to 6 % above 621 501 €", () => {
    expect(imt(630_000, "secondary", parameters2025)).toBe(37_800);
    expect(imt(630_000, "hpp", parameters2025)).toBe(630_000 * 0.08 - 13_493.5);
  });

  it("stores drafts once and never activates them", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    seed(db);
    const first = storeDraftIfNew(db, parameters2026, "test");
    expect(first).toMatchObject({ created: true, row: { status: "draft", version: 1 } });
    expect(storeDraftIfNew(db, parameters2026, "test").created).toBe(false);
    expect(getActiveParameterSet(db, "continente", 2026)?.year).toBe(2025);
    // The seed's own 2025 set is identical, so no duplicate draft is created.
    expect(storeDraftIfNew(db, parameters2025, "test").created).toBe(false);
  });
});
