import type { ParameterSet, ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import { effectiveLoanAmount, runCalculator, SCENARIO_KINDS } from "./run";
import type { CalculatorState } from "./state";

/**
 * Sensitivity analysis on the calculator state (WBS 5.3.7). The shifts mirror the engine's
 * helpers (shiftPurchasePrice, shiftRent/shiftAdr, shiftOccupancy, shiftInterestRate), applied
 * to the form state so that every scenario is recalculated consistently.
 */
export type SensitivityVariable = "price" | "rent" | "occupancy" | "interest";
export type SensitivityMetric = "netProfit" | "irr" | "netYield" | "monthlyCashFlow";

export const SENSITIVITY_RANGES: Record<
  SensitivityVariable,
  { min: number; max: number; step: number; unit: "percent" | "points" }
> = {
  price: { min: -0.2, max: 0.2, step: 0.01, unit: "percent" },
  rent: { min: -0.2, max: 0.2, step: 0.01, unit: "percent" },
  occupancy: { min: -0.2, max: 0.2, step: 0.01, unit: "points" },
  interest: { min: -0.02, max: 0.03, step: 0.0025, unit: "points" },
};

const scale = (v: number | null, factor: number) => (v === null ? null : v * factor);
const clamp01 = (v: number | null, delta: number) =>
  v === null ? null : Math.min(1, Math.max(0, v + delta));

/** The state with one input shifted by `delta` (relative for price and rent, absolute otherwise). */
export function shiftState(
  state: CalculatorState,
  variable: SensitivityVariable,
  delta: number,
): CalculatorState {
  switch (variable) {
    case "price": {
      // Like the engine's shiftPurchasePrice: the loan amount stays as it was.
      const price = state.purchasePrice ?? state.askingPrice;
      if (price === null) return state;
      return {
        ...state,
        purchasePrice: price * (1 + delta),
        loanAmount: effectiveLoanAmount(state, price),
      };
    }
    case "rent":
      return {
        ...state,
        monthlyRent: scale(state.monthlyRent, 1 + delta),
        nightlyRate: {
          high: scale(state.nightlyRate.high, 1 + delta),
          mid: scale(state.nightlyRate.mid, 1 + delta),
          low: scale(state.nightlyRate.low, 1 + delta),
        },
      };
    case "occupancy":
      return {
        ...state,
        occupancy: {
          high: clamp01(state.occupancy.high, delta),
          mid: clamp01(state.occupancy.mid, delta),
          low: clamp01(state.occupancy.low, delta),
        },
      };
    case "interest":
      return { ...state, interestRate: Math.max(0, state.interestRate + delta) };
  }
}

export type SensitivityRow = { delta: number } & Partial<Record<ScenarioKind, number | null>>;

/** Recalculates every scenario for each delta and reads one metric. */
export function sensitivityTable(
  state: CalculatorState,
  params: ParameterSet,
  startMonth: number,
  variable: SensitivityVariable,
  metric: SensitivityMetric,
  deltas: readonly number[],
): SensitivityRow[] {
  return deltas.map((delta) => {
    const output = runCalculator(shiftState(state, variable, delta), params, startMonth);
    const row: SensitivityRow = { delta };
    for (const kind of SCENARIO_KINDS) {
      const result: ScenarioResult | undefined = output.outcomes.find(
        (o) => o.kind === kind,
      )?.result;
      if (result) row[kind] = result[metric];
    }
    return row;
  });
}

/** Evenly spaced deltas across a variable's range, always including 0. */
export function sensitivityDeltas(variable: SensitivityVariable, points = 9): number[] {
  const { min, max } = SENSITIVITY_RANGES[variable];
  const values = Array.from({ length: points }, (_, i) => min + ((max - min) * i) / (points - 1));
  if (!values.some((v) => Math.abs(v) < 1e-9)) values.push(0);
  return values.map((v) => Math.round(v * 10_000) / 10_000).sort((a, b) => a - b);
}
