import type { ScenarioKind, ScenarioResult } from "./simulation";

/**
 * What the investor is optimising for:
 * - profit: highest net profit
 * - irr: highest annualised return
 * - yield: highest net yield (rental scenarios only)
 * - capital: lowest peak capital among profitable scenarios
 */
export type Goal = "profit" | "irr" | "yield" | "capital";

export interface Comparison {
  goal: Goal;
  /** Viable scenarios that can be ranked for the goal, best first. */
  ranking: ScenarioKind[];
  best: ScenarioKind | null;
}

const score: Record<Goal, (r: ScenarioResult) => number | null> = {
  profit: (r) => r.netProfit,
  irr: (r) => r.irr,
  yield: (r) => r.netYield,
  capital: (r) => (r.netProfit > 0 ? -r.peakCapital : null),
};

/** Ranks scenario results for a goal; non-viable scenarios and those without a score are left out. */
export function compareScenarios(results: readonly ScenarioResult[], goal: Goal): Comparison {
  const ranked = results
    .filter((r) => r.viable)
    .map((r) => ({ kind: r.kind, value: score[goal](r) }))
    .filter((r): r is { kind: ScenarioKind; value: number } => r.value !== null)
    .sort((a, b) => b.value - a.value)
    .map((r) => r.kind);
  return { goal, ranking: ranked, best: ranked[0] ?? null };
}
