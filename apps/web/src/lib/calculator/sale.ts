import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { permanentRentalYears, runCalculator } from "./run";
import type { CalculatorState } from "./state";

/**
 * What the sale must bring in (WBS 5.3.7, replacing the sensitivity sliders): the lowest sale
 * price without a loss, and the net profit in 5 % steps above it. For the long-term rental,
 * which is kept, it is a sale at the end of its horizon; for the contract assignment, the
 * assignment price.
 */
export interface SaleAnalysis {
  /** Lowest sale price with a net profit ≥ 0; null when no price up to the search limit is. */
  breakEven: number | null;
  /** The price the user expects (resale price, market value, assignment price), if any. */
  expected: number | null;
  /**
   * Net profit at the base price and 5 % steps above it, up to +20 %. The base is the
   * break-even price; when there is a profit at any price, the expected price. Empty when
   * there is no break-even price.
   */
  steps: SaleStep[];
  /** What the steps start from. */
  stepsFrom: "breakEven" | "expected" | null;
  /** Long-term rental: the sale is assumed after this many years. */
  years: number | null;
}

export interface SaleStep {
  /** 0, 0.05 … 0.2 above the base price. */
  change: number;
  price: number;
  profit: number;
}

/** Up to +20 %: selling for more than that above the lowest price is rare. */
export const SALE_STEPS = [0, 0.05, 0.1, 0.15, 0.2];

export function profitAtSale(
  state: CalculatorState,
  params: ParameterSet,
  startMonth: number,
  deal: ScenarioKind,
  price: number,
): number | null {
  const outcome = runCalculator(state, params, startMonth, { only: deal, salePrice: price })
    .outcomes[0];
  return outcome?.result?.netProfit ?? null;
}

/** The price the user entered for the sale of this deal. */
function expectedPrice(state: CalculatorState, deal: ScenarioKind): number | null {
  const valueAfterWorks =
    state.renovationBudget > 0 && state.resaleValue ? state.resaleValue : state.marketValue;
  switch (deal) {
    case "flip":
      return state.resaleValue;
    case "shortTermRental":
    case "longTermRental":
      return valueAfterWorks ?? state.purchasePrice ?? state.askingPrice;
    case "contractAssignment":
      return state.assignmentPrice;
  }
}

export function saleAnalysis(
  state: CalculatorState,
  params: ParameterSet,
  startMonth: number,
  deal: ScenarioKind,
): SaleAnalysis | null {
  const profit = (price: number) => profitAtSale(state, params, startMonth, deal, price);
  // A price of 0 counts as "not entered", so the lowest price tried is 1 €.
  if (profit(1) === null) return null;
  const expected = expectedPrice(state, deal);

  // Profit grows with the price: find where it crosses zero by bisection.
  const scale = Math.max(
    expected ?? 0,
    state.purchasePrice ?? state.askingPrice ?? 0,
    state.deposit ?? 0,
    10_000,
  );
  let low = 1;
  let high = scale;
  for (let i = 0; i < 20 && (profit(high) ?? -1) < 0; i++) high *= 2;
  let breakEven: number | null = null;
  if ((profit(high) ?? -1) >= 0) {
    if ((profit(1) ?? -1) >= 0) {
      breakEven = 1;
    } else {
      for (let i = 0; i < 50 && high - low > 1; i++) {
        const mid = (low + high) / 2;
        if ((profit(mid) ?? -1) >= 0) high = mid;
        else low = mid;
      }
      breakEven = Math.ceil(high);
    }
  }

  // Profitable at any price (a break-even of 1 €): steps from the price the user expects.
  const stepsFrom =
    breakEven === null ? null : breakEven > 1 ? "breakEven" : expected ? "expected" : null;
  const base = stepsFrom === "breakEven" ? breakEven! : stepsFrom === "expected" ? expected! : 0;
  const steps = stepsFrom
    ? SALE_STEPS.map((change) => {
        const price = Math.round(base * (1 + change));
        return { change, price, profit: profit(price) ?? 0 };
      })
    : [];

  return {
    breakEven,
    expected,
    steps,
    stepsFrom,
    years: deal === "longTermRental" ? permanentRentalYears(state) : null,
  };
}

/**
 * The step at the price the user entered (within half a step of it), or -1. A price below the
 * first step, where the sale makes a loss, is not one of the steps.
 */
export function nearStep(steps: SaleStep[], expected: number | null): number {
  if (expected === null || steps.length === 0) return -1;
  const halfStep = steps[0]!.price * 0.025;
  if (expected < steps[0]!.price) return -1;
  return steps.findIndex((s) => Math.abs(s.price - expected) <= halfStep);
}
