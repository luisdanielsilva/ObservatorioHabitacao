import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { permanentRentalYears, runCalculator } from "./run";
import type { CalculatorState } from "./state";

/**
 * What the sale must bring in (WBS 5.3.7, replacing the sensitivity sliders): the lowest sale
 * price without a loss, and the net profit at prices above it. For the long-term rental, which
 * is kept, it is a sale at the end of its horizon; for the contract assignment, the assignment
 * price.
 */
export interface SaleAnalysis {
  /** Lowest sale price with a net profit ≥ 0; null when no price up to the search limit is. */
  breakEven: number | null;
  /** The price the user expects (resale price, market value, assignment price), if any. */
  expected: number | null;
  points: { price: number; profit: number }[];
  /** Long-term rental: the sale is assumed after this many years. */
  years: number | null;
}

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

const POINTS = 31;

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

  // From the break-even point up: far enough to show the expected price and a margin above it.
  const from = breakEven ?? scale * 0.5;
  const to = Math.max(from * 1.5, (expected ?? 0) * 1.25, from + 10_000);
  const points = Array.from({ length: POINTS }, (_, i) => {
    const price = Math.round(from + ((to - from) * i) / (POINTS - 1));
    return { price, profit: profit(price) ?? 0 };
  });

  return {
    breakEven,
    expected,
    points,
    years: deal === "longTermRental" ? permanentRentalYears(state) : null,
  };
}
