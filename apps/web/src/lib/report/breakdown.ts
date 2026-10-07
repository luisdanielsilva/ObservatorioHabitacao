import type { ScenarioResult } from "@olhovivo/engine";

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
