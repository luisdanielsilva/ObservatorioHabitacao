/**
 * Opportunity signal (WBS 5.4): how the asking price compares with the market value.
 * In v1 the market value is entered by the user; later it comes from automatic estimates.
 */
export type OpportunitySignal = "opportunity" | "fair" | "above";

export interface Opportunity {
  /** (asking − market) ÷ market: −0.1 means 10 % below market. */
  difference: number;
  signal: OpportunitySignal;
}

/** More than `threshold` below market is an opportunity, more than above is above market. */
export function classifyOpportunity(
  askingPrice: number,
  marketValue: number,
  threshold = 0.05,
): Opportunity | null {
  if (!(askingPrice > 0) || !(marketValue > 0)) return null;
  const difference = askingPrice / marketValue - 1;
  // Tolerance so that exactly ±threshold counts as fair despite floating-point noise.
  const edge = threshold + 1e-9;
  const signal = difference < -edge ? "opportunity" : difference > edge ? "above" : "fair";
  return { difference, signal };
}
