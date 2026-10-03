import type { ParameterSet } from "../params";
import {
  fixedCostsMonthly,
  simulate,
  summarise,
  type PropertyInputs,
  type ScenarioResult,
} from "../simulation";

/** Buy, renovate and resell (fix & flip). */
export interface FlipInputs extends PropertyInputs {
  /** Electricity, water and gas while the property is held. */
  utilitiesMonthly: number;
}

/**
 * Fix & flip: no operating income; holding costs (IMI, condominium, insurance, utilities,
 * loan payments) run until the sale, where capital gains tax is due.
 */
export function runFlip(input: FlipInputs, params: ParameterSet): ScenarioResult {
  const holdingCosts = fixedCostsMonthly(input) + input.utilitiesMonthly;
  const sim = simulate({
    input,
    params,
    operating: () => ({ income: 0, costs: holdingCosts }),
    incomeTax: () => 0,
  });
  return summarise("flip", sim, input.loan?.amount ?? 0, null);
}
