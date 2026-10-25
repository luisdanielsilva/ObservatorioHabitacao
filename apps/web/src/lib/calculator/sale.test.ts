import type { ParameterSet } from "@observatorio-habitacao/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { runCalculator } from "./run";
import { nearStep, profitAtSale, saleAnalysis } from "./sale";
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

  it("steps up from the break-even price in 5 % steps, to +20 %", () => {
    const sale = saleAnalysis(state, params, 1, "flip")!;
    expect(sale.stepsFrom).toBe("breakEven");
    expect(sale.steps.map((s) => s.change)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
    expect(sale.steps[0]!.price).toBe(sale.breakEven);
    expect(sale.steps[0]!.profit).toBeCloseTo(0, -2);
    expect(sale.steps[2]!.price).toBe(Math.round(sale.breakEven! * 1.1));
    const profits = sale.steps.map((s) => s.profit);
    expect(profits).toEqual([...profits].sort((a, b) => a - b));
    expect(profits.at(-1)!).toBeGreaterThan(0);
  });

  it("steps from the expected price when there is a profit at any price", () => {
    // Stays that pay off the property: no sale price makes a loss.
    const rich = initialState({
      askingPrice: 100_000,
      marketValue: 150_000,
      nightlyRate: { high: 400, mid: 350, low: 300 },
      occupancy: { high: 0.9, mid: 0.9, low: 0.9 },
    });
    const sale = saleAnalysis(rich, params, 1, "shortTermRental")!;
    expect(sale.breakEven).toBe(1);
    expect(sale.stepsFrom).toBe("expected");
    expect(sale.steps[0]!.price).toBe(150_000);
  });

  it("sells the long-term rental at the end of its horizon, from what it cost to let", () => {
    const withWorks = { ...state, renovationBudget: 25_000, renovationMonths: 2 };
    const sale = saleAnalysis(withWorks, params, 1, "longTermRental")!;
    expect(sale.years).toBe(30);
    // The price, the purchase costs and the works, whatever the rents brought in.
    const rental = runCalculator(withWorks, params, 1, { only: "longTermRental" }).outcomes[0]!;
    expect(sale.breakEven).toBe(Math.ceil(rental.result!.totalInvestment));
    expect(sale.breakEven!).toBeGreaterThan(200_000 + 25_000);
    expect(sale.stepsFrom).toBe("breakEven");
    expect(sale.steps[0]!.price).toBe(sale.breakEven);
    // Even when the rents alone pay the property off.
    const rich = initialState({ askingPrice: 100_000, monthlyRent: 3_000, marketValue: 150_000 });
    expect(saleAnalysis(rich, params, 1, "longTermRental")!.stepsFrom).toBe("breakEven");
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

  it("marks the step at the price entered, but not a price below the steps", () => {
    const steps = [0, 0.05, 0.1].map((change) => ({
      change,
      price: Math.round(400_000 * (1 + change)),
      profit: 0,
    }));
    expect(nearStep(steps, 421_000)).toBe(1);
    expect(nearStep(steps, 400_000)).toBe(0);
    // Below the lowest price without a loss: not "near" the first step.
    expect(nearStep(steps, 395_000)).toBe(-1);
    expect(nearStep(steps, 470_000)).toBe(-1); // above the last step
    expect(nearStep(steps, null)).toBe(-1);
  });
});
