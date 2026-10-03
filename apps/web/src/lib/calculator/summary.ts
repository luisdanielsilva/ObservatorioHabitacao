import type { ScenarioKind } from "@olhovivo/engine";
import type { CalculatorOutput, MissingField } from "./run";
import type { CalculatorState } from "./state";

export interface ScenarioSummary {
  netProfit: number;
  irr: number | null;
  roi: number | null;
  grossYield: number | null;
  netYield: number | null;
  monthlyCashFlow: number | null;
  returnOnDeposit: number | null;
  ownCapital: number;
  viable: boolean;
}

export interface ResultsSummary {
  best: ScenarioKind | null;
  goal: string;
  opportunity: CalculatorOutput["opportunity"];
  scenarios: Partial<Record<ScenarioKind, ScenarioSummary | { missing: MissingField[] }>>;
}

/** The key figures stored with a saved scenario, for lists and previews. */
export function summariseOutput(output: CalculatorOutput): ResultsSummary {
  return {
    best: output.comparison.best,
    goal: output.comparison.goal,
    opportunity: output.opportunity,
    scenarios: Object.fromEntries(
      output.outcomes.map((o) => [
        o.kind,
        o.result
          ? {
              netProfit: o.result.netProfit,
              irr: o.result.irr,
              roi: o.result.roi,
              grossYield: o.result.grossYield,
              netYield: o.result.netYield,
              monthlyCashFlow: o.result.monthlyCashFlow,
              returnOnDeposit: o.result.returnOnDeposit,
              ownCapital: o.result.ownCapital,
              viable: o.result.viable,
            }
          : { missing: o.missing },
      ]),
    ),
  };
}

/** The property part of the state, kept as a snapshot with the scenario. */
export function propertySnapshot(state: CalculatorState) {
  const { url, areaId, address, propertyType, bedrooms, areaM2, condition, askingPrice, extras } =
    state;
  return { url, areaId, address, propertyType, bedrooms, areaM2, condition, askingPrice, extras };
}
