import type { ParameterSet } from "@olhovivo/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { profitAtSale, saleAnalysis } from "./sale";
import { initialState } from "./state";

const params: ParameterSet = params2025;
const state = initialState({
  askingPrice: 200_000,
  resaleValue: 260_000,
  monthlyRent: 1_000,
  marketValue: 210_000,
  deposit: 20_000,
  assignmentPrice: 35_000,
});

describe("saleAnalysis", () => {
  it("finds the lowest resale price without a loss", () => {
    const sale = saleAnalysis(state, params, 1, "flip")!;
    expect(sale.breakEven).not.toBeNull();
    // Just below the break-even price there is a loss, at it there is none.
    expect(profitAtSale(state, params, 1, "flip", sale.breakEven! - 50)!).toBeLessThan(0);
    expect(profitAtSale(state, params, 1, "flip", sale.breakEven!)!).toBeGreaterThanOrEqual(0);
    // Buying costs and selling costs mean it is above the purchase price.
    expect(sale.breakEven!).toBeGreaterThan(200_000);
    expect(sale.expected).toBe(260_000);
  });

  it("charts profit from the break-even price upwards, past the expected price", () => {
    const sale = saleAnalysis(state, params, 1, "flip")!;
    expect(sale.points[0]!.price).toBe(sale.breakEven);
    expect(sale.points[0]!.profit).toBeCloseTo(0, -2);
    expect(sale.points.at(-1)!.price).toBeGreaterThan(260_000);
    const profits = sale.points.map((p) => p.profit);
    expect(profits).toEqual([...profits].sort((a, b) => a - b));
  });

  it("sells the long-term rental at the end of its horizon", () => {
    const sale = saleAnalysis(state, params, 1, "longTermRental")!;
    expect(sale.years).toBe(30);
    expect(sale.breakEven).not.toBeNull();
  });

  it("uses the assignment price for the contract position sale", () => {
    const sale = saleAnalysis(state, params, 1, "contractAssignment")!;
    expect(sale.expected).toBe(35_000);
    // Below the deposit paid, the assignment loses money.
    expect(sale.breakEven!).toBeGreaterThan(20_000);
  });

  it("is null when the deal cannot be calculated", () => {
    expect(saleAnalysis(initialState(), params, 1, "flip")).toBeNull();
  });
});
