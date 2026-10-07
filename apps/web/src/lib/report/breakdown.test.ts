import type { ParameterSet } from "@olhovivo/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { runCalculator } from "../calculator/run";
import { initialState } from "../calculator/state";
import { cashBreakdown } from "./breakdown";

const params: ParameterSet = params2025;
const result = (kind: string, overrides: Parameters<typeof initialState>[0]) =>
  runCalculator(initialState(overrides), params, 1).outcomes.find((o) => o.kind === kind)!.result!;

describe("cashBreakdown", () => {
  it("adds up to the net profit of a resale, with a loan", () => {
    const flip = result("flip", { askingPrice: 200_000, resaleValue: 260_000, useLoan: true });
    const b = cashBreakdown(flip);
    expect(b.total).toBeCloseTo(flip.netProfit!, 2);
    // Paid upfront: price and purchase costs, less the loan.
    expect(b.rows.initial).toBeCloseTo(-(flip.totalInvestment - flip.loanAmount), 2);
    expect(b.rows.saleProceeds).toBeGreaterThan(0);
    expect(b.rows.loanPayoff).toBeLessThan(0);
    expect(b.rows.debtService).toBeLessThan(0);
    expect(b.rows.income).toBe(0);
  });

  it("for a kept rental: the initial payment plus the lifetime cash flow, no sale", () => {
    const rental = result("longTermRental", { askingPrice: 200_000, monthlyRent: 1_000 });
    const b = cashBreakdown(rental);
    expect(b.rows.saleProceeds).toBe(0);
    expect(b.rows.income).toBeGreaterThan(0);
    expect(b.total).toBeCloseTo(b.rows.initial + rental.lifetimeCashFlow!, 2);
    expect(b.total).toBeCloseTo(rental.months.at(-1)!.cumulative, 2);
    expect(b.months).toBe(rental.months.length - 1);
  });
});
