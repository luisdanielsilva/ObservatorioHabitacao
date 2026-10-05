import { describe, expect, it } from "vitest";
import { params2025 as params } from "./__fixtures__/params2025";
import { compareScenarios } from "./compare";
import { runLongTermRental, type LongTermRentalInputs } from "./scenarios/longTermRental";
import {
  sensitivity,
  shiftInterestRate,
  shiftOccupancy,
  shiftPurchasePrice,
  shiftRent,
} from "./sensitivity";
import type { ScenarioResult } from "./simulation";

function result(overrides: Partial<ScenarioResult>): ScenarioResult {
  return {
    kind: "flip",
    viable: true,
    warnings: [],
    acquisition: null,
    totalInvestment: 0,
    loanAmount: 0,
    ownCapital: 0,
    peakCapital: 0,
    netProfit: 0,
    roi: null,
    irr: null,
    grossYield: null,
    netYield: null,
    monthlyCashFlow: null,
    paybackYears: null,
    returnOnDeposit: null,
    months: [],
    ...overrides,
  };
}

describe("compareScenarios", () => {
  const results = [
    result({ kind: "flip", netProfit: 40_000, irr: 0.3, peakCapital: 240_000 }),
    result({
      kind: "longTermRental",
      netProfit: 60_000,
      irr: 0.06,
      netYield: 0.04,
      peakCapital: 210_000,
    }),
    result({
      kind: "shortTermRental",
      netProfit: 90_000,
      irr: 0.09,
      netYield: 0.06,
      peakCapital: 220_000,
      viable: false,
    }),
    result({ kind: "contractAssignment", netProfit: -1_000, irr: -0.1, peakCapital: 30_000 }),
  ];

  it("ranks by the chosen goal and skips non-viable scenarios", () => {
    expect(compareScenarios(results, "profit").ranking).toEqual([
      "longTermRental",
      "flip",
      "contractAssignment",
    ]);
    expect(compareScenarios(results, "irr").best).toBe("flip");
  });

  it("ranks yield only among rental scenarios", () => {
    expect(compareScenarios(results, "yield").ranking).toEqual(["longTermRental"]);
  });

  it("prefers the lowest capital among profitable scenarios", () => {
    expect(compareScenarios(results, "capital").ranking).toEqual(["longTermRental", "flip"]);
  });

  it("returns no best scenario when none qualifies", () => {
    expect(compareScenarios([], "profit").best).toBeNull();
  });
});

describe("sensitivity", () => {
  const input: LongTermRentalInputs = {
    purchasePrice: 200_000,
    propertyUse: "secondary",
    vpt: 100_000,
    imiRate: 0.003,
    renovationBudget: 0,
    renovationMonths: 0,
    loan: { amount: 140_000, annualRate: 0.035, termYears: 30 },
    holdingMonths: 120,
    exitPrice: 240_000,
    sellingCommissionRate: 0.05,
    otherTaxableIncome: 30_000,
    condominiumMonthly: 40,
    insuranceAnnual: 200,
    monthlyRent: 1_000,
    rentGrowthRate: 0.02,
    vacancyRate: 1 / 12,
    maintenanceRate: 0.05,
    managementRate: 0,
    rentalTax: { mode: "autonomous", contractYears: 1 },
  };
  const run = (i: LongTermRentalInputs) => runLongTermRental(i, params);
  const deltas = [-0.1, 0, 0.1];

  it("returns one point per delta, with the base case at zero", () => {
    const points = sensitivity(run, input, shiftRent, deltas, (r) => r.netYield);
    expect(points.map((p) => p.delta)).toEqual(deltas);
    expect(points[1]!.value).toBeCloseTo(run(input).netYield!, 12);
  });

  it("moves results in the expected direction", () => {
    const values = (
      shift: (i: LongTermRentalInputs, d: number) => LongTermRentalInputs,
      metric: (r: ScenarioResult) => number | null,
    ) => sensitivity(run, input, shift, deltas, metric).map((p) => p.value!);

    const byRent = values(shiftRent, (r) => r.netYield);
    expect(byRent[0]).toBeLessThan(byRent[1]!);
    expect(byRent[1]).toBeLessThan(byRent[2]!);

    const byPrice = values(shiftPurchasePrice, (r) => r.grossYield);
    expect(byPrice[0]).toBeGreaterThan(byPrice[2]!);

    const byRate = sensitivity(
      run,
      input,
      shiftInterestRate,
      [-0.01, 0.01],
      (r) => r.monthlyCashFlow,
    );
    expect(byRate[0]!.value!).toBeGreaterThan(byRate[1]!.value!);
  });

  it("keeps occupancy within 0–1", () => {
    const shifted = shiftOccupancy({ occupancy: [0.95, 0.05] }, 0.1);
    expect(shifted.occupancy[0]).toBe(1);
    expect(shifted.occupancy[1]).toBeCloseTo(0.15, 12);
  });
});
