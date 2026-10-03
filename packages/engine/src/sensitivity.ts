import type { PropertyInputs, ScenarioResult } from "./simulation";

export interface SensitivityPoint {
  delta: number;
  value: number | null;
}

/**
 * Re-runs a scenario with one input shifted by each delta and reads one metric.
 *
 * @example
 * sensitivity((i) => runLongTermRental(i, params), base, shiftRent, [-0.1, 0, 0.1], (r) => r.netYield)
 */
export function sensitivity<I>(
  run: (input: I) => ScenarioResult,
  base: I,
  shift: (input: I, delta: number) => I,
  deltas: readonly number[],
  metric: (result: ScenarioResult) => number | null,
): SensitivityPoint[] {
  return deltas.map((delta) => ({ delta, value: metric(run(shift(base, delta))) }));
}

/** Purchase price × (1 + delta). The loan amount is kept. */
export function shiftPurchasePrice<I extends PropertyInputs>(input: I, delta: number): I {
  return { ...input, purchasePrice: input.purchasePrice * (1 + delta) };
}

/** Interest rate + delta, in absolute terms (0.01 = one percentage point). */
export function shiftInterestRate<I extends PropertyInputs>(input: I, delta: number): I {
  if (!input.loan) return input;
  return {
    ...input,
    loan: { ...input.loan, annualRate: Math.max(0, input.loan.annualRate + delta) },
  };
}

/** Long-term rent × (1 + delta). */
export function shiftRent<I extends { monthlyRent: number }>(input: I, delta: number): I {
  return { ...input, monthlyRent: input.monthlyRent * (1 + delta) };
}

/** Short-term daily rates × (1 + delta). */
export function shiftAdr<I extends { adr: readonly number[] }>(input: I, delta: number): I {
  return { ...input, adr: input.adr.map((a) => a * (1 + delta)) };
}

/** Short-term occupancy + delta, in absolute terms, kept within 0–1. */
export function shiftOccupancy<I extends { occupancy: readonly number[] }>(
  input: I,
  delta: number,
): I {
  return { ...input, occupancy: input.occupancy.map((o) => Math.min(1, Math.max(0, o + delta))) };
}
