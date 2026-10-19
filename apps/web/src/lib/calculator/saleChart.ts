import type { ParameterSet, ScenarioKind } from "@observatorio-habitacao/engine";
import { cashBreakdown, type CashBreakdown } from "../report/breakdown";
import { runCalculator } from "./run";
import type { CalculatorState } from "./state";

/** The deal's money in and out with the sale at `price`, or null if it cannot be calculated. */
export function breakdownAtSale(
  state: CalculatorState,
  params: ParameterSet,
  startMonth: number,
  deal: ScenarioKind,
  price: number,
): CashBreakdown | null {
  const result = runCalculator(state, params, startMonth, { only: deal, salePrice: price })
    .outcomes[0]?.result;
  return result ? cashBreakdown(result) : null;
}

/**
 * Where a sale price goes, from the bottom of its column up (issue #10): the loan paid off,
 * the money put in coming back, the commission and the IRS on the gain, and the profit. The
 * parts add up to the price.
 */
export interface PriceSplit {
  price: number;
  loan: number;
  ownMoney: number;
  costs: number;
  profit: number;
}

/**
 * The split of `price`, or null when a part is below zero and cannot be stacked: a loss, or
 * income during the deal larger than the money put in.
 */
export function priceSplit(price: number, b: CashBreakdown): PriceSplit | null {
  const r = b.rows;
  const split = {
    price,
    loan: -r.loanPayoff,
    ownMoney: -(
      r.initial +
      r.income +
      r.operatingCosts +
      r.renovation +
      r.debtService +
      r.incomeTax
    ),
    // The sale proceeds are net of the commission (and, for an assignment, its other costs).
    costs: price - r.saleProceeds - r.capitalGainsTax,
    profit: b.total,
  };
  return [split.loan, split.ownMoney, split.costs, split.profit].some((v) => v < -0.5)
    ? null
    : split;
}

export const SALE_BARS = [
  "price",
  "commission",
  "loanPayoff",
  "initial",
  "income",
  "operatingCosts",
  "renovation",
  "debtService",
  "incomeTax",
  "capitalGainsTax",
  "profit",
] as const;

export type SaleBarKey = (typeof SALE_BARS)[number];

/** One bar of the waterfall from the sale price to the profit. */
export interface SaleBar {
  key: SaleBarKey;
  from: number;
  to: number;
  value: number;
}

/**
 * From the sale price down to the profit (issue #10): the price, then each flow of money that
 * happens (commission, loan, initial payment, rents, costs, taxes) from where the previous one
 * left the balance, and the profit from zero.
 */
export function saleWaterfall(price: number, b: CashBreakdown): SaleBar[] {
  const r = b.rows;
  // The sale proceeds are the price less the commission: drawn as the price and its commission.
  const flows: Record<Exclude<SaleBarKey, "price" | "profit">, number> = {
    commission: r.saleProceeds - price,
    loanPayoff: r.loanPayoff,
    initial: r.initial,
    income: r.income,
    operatingCosts: r.operatingCosts,
    renovation: r.renovation,
    debtService: r.debtService,
    incomeTax: r.incomeTax,
    capitalGainsTax: r.capitalGainsTax,
  };
  const bars: SaleBar[] = [{ key: "price", from: 0, to: price, value: price }];
  for (const key of SALE_BARS) {
    if (key === "price" || key === "profit") continue;
    const value = flows[key];
    if (Math.abs(value) < 0.5) continue;
    const from = bars.at(-1)!.to;
    bars.push({ key, from, to: from + value, value });
  }
  bars.push({ key: "profit", from: 0, to: b.total, value: b.total });
  return bars;
}
