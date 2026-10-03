/**
 * Generic financial metrics shared by all scenarios.
 *
 * Cash-flow convention: index 0 is the start of the investment (usually negative,
 * own capital put in), and each following entry is one period later. Scenarios use
 * monthly periods; annualise with {@link annualise}.
 */

/** Net present value of `cashFlows` at a per-period `rate`. */
export function npv(rate: number, cashFlows: readonly number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t]! / (1 + rate) ** t;
  }
  return total;
}

/**
 * Internal rate of return per period: the rate at which NPV is zero.
 *
 * Uses bisection, which always converges when a sign change exists. Returns `null`
 * when the series has no sign change (no IRR exists) or no root in (-99.99%, 1000%).
 */
export function irr(cashFlows: readonly number[], tolerance = 1e-10): number | null {
  const hasPositive = cashFlows.some((c) => c > 0);
  const hasNegative = cashFlows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.9999;
  let high = 10;
  let npvLow = npv(low, cashFlows);
  if (npvLow * npv(high, cashFlows) > 0) return null;

  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid, cashFlows);
    if (Math.abs(npvMid) < tolerance || high - low < tolerance) return mid;
    if (npvLow * npvMid < 0) {
      high = mid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return (low + high) / 2;
}

/** Converts a per-period rate into an annual rate, e.g. monthly IRR → annual IRR. */
export function annualise(ratePerPeriod: number, periodsPerYear = 12): number {
  return (1 + ratePerPeriod) ** periodsPerYear - 1;
}
