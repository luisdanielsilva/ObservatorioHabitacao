import { hasTypology } from "../calculator/flow";
import type { ValuationState } from "./state";

/** The steps of Vender: the property, similar listings, the sale (optional) and the result. */
export type ValuationStep = "property" | "comparables" | "sale" | "results";
export const VALUATION_STEPS: ValuationStep[] = ["property", "comparables", "sale", "results"];

export type ValuationField = "areaId" | "areaM2" | "bedrooms" | "floor";

/**
 * Property fields still to fill in. The location needs the parish (`areaDepth` 3), whose INE
 * median is the base; an apartment's floor decides what a missing lift costs.
 */
export function missingValuationFields(state: ValuationState, areaDepth: number): ValuationField[] {
  const missing: ValuationField[] = [];
  if (areaDepth < 3) missing.push("areaId");
  if (!(state.areaM2 && state.areaM2 > 0)) missing.push("areaM2");
  if (hasTypology(state.propertyType) && state.bedrooms === null) missing.push("bedrooms");
  if (state.propertyType === "apartamento" && state.floor === null) missing.push("floor");
  return missing;
}

/** The property types Vender values: homes, the ones the INE median describes. */
export const VALUED_TYPES = ["apartamento", "moradia"] as const;
