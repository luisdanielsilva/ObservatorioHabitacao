import type { ScenarioResult } from "@observatorio-habitacao/engine";

export const BREAKDOWN_ROWS = [
  "initial",
  "income",
  "operatingCosts",
  "renovation",
  "debtService",
  "incomeTax",
  "saleProceeds",
  "loanPayoff",
  "capitalGainsTax",
] as const;

export type BreakdownRow = (typeof BREAKDOWN_ROWS)[number];

/** Money in (+) and out (−) over a deal's whole period, after financing and taxes. */
export interface CashBreakdown {
  rows: Record<BreakdownRow, number>;
  /** The sum of the rows: the cash left at the end of the period (net profit when sold). */
  total: number;
  /** Months from purchase (or deposit) to the sale, assignment or end of the horizon. */
  months: number;
}

/**
 * Sums a deal's monthly cash flows by kind. Month 0 is the initial payment: price, purchase
 * costs and upfront works less the loan (the deposit, for a contract assignment).
 */
export function cashBreakdown(result: ScenarioResult): CashBreakdown {
  const [start, ...lines] = result.months;
  const sum = (key: keyof (typeof lines)[number]) =>
    lines.reduce((total, line) => total + (line[key] as number), 0);
  const rows: Record<BreakdownRow, number> = {
    initial: start?.cashFlow ?? 0,
    income: sum("income"),
    operatingCosts: -sum("operatingCosts"),
    renovation: -sum("renovation"),
    debtService: -sum("debtService"),
    incomeTax: -sum("incomeTax"),
    saleProceeds: sum("saleProceeds"),
    loanPayoff: -sum("loanPayoff"),
    capitalGainsTax: -sum("capitalGainsTax"),
  };
  return {
    rows,
    total: BREAKDOWN_ROWS.reduce((total, row) => total + rows[row], 0),
    months: lines.length,
  };
}

/** One bar of a waterfall: the balance before and after a flow of money. */
export interface WaterfallBar {
  key: BreakdownRow | "total";
  from: number;
  to: number;
  value: number;
}

/**
 * The breakdown as a waterfall: each flow that happens moves the balance from where the
 * previous one left it; the last bar is the result, from zero.
 */
export function waterfallBars(b: CashBreakdown): WaterfallBar[] {
  const bars: WaterfallBar[] = [];
  for (const row of BREAKDOWN_ROWS) {
    const value = b.rows[row];
    if (Math.abs(value) < 0.5) continue;
    const from = bars.at(-1)?.to ?? 0;
    bars.push({ key: row, from, to: from + value, value });
  }
  if (bars.length) bars.push({ key: "total", from: 0, to: b.total, value: b.total });
  return bars;
}

/**
 * Where the step labels go beside the result column: at their block, but at least a line apart
 * (small steps next to large flows would otherwise print on top of each other). `ys` runs from
 * the lowest price up, so each label is moved up from the one before when needed.
 */
export function stepLabels(ys: number[], gap = 8): number[] {
  const out: number[] = [];
  for (const y of ys) out.push(out.length ? Math.min(y, out.at(-1)! - gap) : y);
  // Kept inside the chart: if the top one went off it, the whole set moves down.
  const shift = Math.max(0, gap - (out.at(-1) ?? gap));
  return out.map((y) => y + shift);
}
