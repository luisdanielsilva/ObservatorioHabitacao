import type { ScenarioKind } from "@olhovivo/engine";
import type { CalculatorOutput, MissingField } from "./run";
import type { CalculatorState, PropertyType } from "./state";

/**
 * The steps of Avaliar anúncio: the property (from a link or entered by hand), the deal type,
 * the details that deal needs, and its results.
 */
export type Step = "property" | "deal" | "details" | "results";

export type PropertyField = "askingPrice" | "bedrooms" | "areaM2" | "areaId";

/** Typology only applies to homes. */
export const hasTypology = (type: PropertyType) => type === "apartamento" || type === "moradia";

/**
 * Property fields still to fill in before choosing a deal. The location needs at least the
 * municipality (`areaDepth` 2), which sets the IMI rate and the INE reference.
 */
export function missingPropertyFields(state: CalculatorState, areaDepth: number): PropertyField[] {
  const missing: PropertyField[] = [];
  if (!(state.askingPrice && state.askingPrice > 0)) missing.push("askingPrice");
  if (hasTypology(state.propertyType) && state.bedrooms === null) missing.push("bedrooms");
  if (!(state.areaM2 && state.areaM2 > 0)) missing.push("areaM2");
  if (areaDepth < 2) missing.push("areaId");
  return missing;
}

/** Inputs the chosen deal still needs, as reported by the calculation. */
export function missingDealFields(
  output: CalculatorOutput | null,
  deal: ScenarioKind,
): MissingField[] {
  return output?.outcomes.find((o) => o.kind === deal)?.missing ?? [];
}

/** Where to start: a saved scenario or restored draft opens at the furthest complete step. */
export function initialStep(
  state: CalculatorState,
  output: CalculatorOutput | null,
  areaDepth: number,
): Step {
  if (missingPropertyFields(state, areaDepth).length > 0) return "property";
  if (state.deal === null) return "deal";
  if (!output || missingDealFields(output, state.deal).length > 0) return "details";
  return "results";
}
