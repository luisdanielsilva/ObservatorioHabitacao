import type { ParameterSet } from "@olhovivo/engine";

/**
 * Where englobamento of rents can pay off: the top of the highest IRS bracket whose rate is
 * below the flat rate on rents. With taxable income up to there, rents added to income are taxed
 * at less than the flat rate. null if no bracket qualifies.
 */
export function englobamentoThreshold(
  params: ParameterSet,
): { income: number; marginalRate: number; flatRate: number } | null {
  const flatRate = params.rentalIncome.autonomousRate;
  const below = params.irs.brackets.filter((b) => b.rate < flatRate && b.upTo !== null);
  const top = below.at(-1);
  return top ? { income: top.upTo!, marginalRate: top.rate, flatRate } : null;
}
