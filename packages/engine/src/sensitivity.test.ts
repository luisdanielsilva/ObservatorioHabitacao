import { describe, expect, it } from "vitest";
import { params2025 as params } from "./__fixtures__/params2025";
import { runLongTermRental, type LongTermRentalInputs } from "./scenarios/longTermRental";
import {
  sensitivity,
  shiftInterestRate,
  shiftOccupancy,
  shiftPurchasePrice,
  shiftRent,
} from "./sensitivity";
import type { ScenarioResult } from "./simulation";

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
    contractMonths: 12,
    vacancyMonths: 1,
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
