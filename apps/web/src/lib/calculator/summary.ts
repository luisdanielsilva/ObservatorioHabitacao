import type { ScenarioKind } from "@observatorio-habitacao/engine";
import type { CalculatorOutput, MissingField } from "./run";
import type { CalculatorState } from "./state";

export interface ScenarioSummary {
  /** Null for a property that is kept (no sale). */
  netProfit: number | null;
  /** Kept property: rent left over the holding period (absent in older summaries). */
  lifetimeCashFlow?: number | null;
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
  opportunity: CalculatorOutput["opportunity"];
  scenarios: Partial<Record<ScenarioKind, ScenarioSummary | { missing: MissingField[] }>>;
}

/** The key figures stored with a saved scenario, for lists and previews. */
export function summariseOutput(output: CalculatorOutput): ResultsSummary {
  return {
    opportunity: output.opportunity,
    scenarios: Object.fromEntries(
      output.outcomes.map((o) => [
        o.kind,
        o.result
          ? {
              netProfit: o.result.netProfit,
              lifetimeCashFlow: o.result.lifetimeCashFlow,
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
