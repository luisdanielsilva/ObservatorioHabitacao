import type { Condition, Feature, PropertyType } from "../calculator/state";

/**
 * The assumptions of the seller's valuation (Vender), all in one place. They are estimates, not
 * published figures: each is shown to the seller next to the result, and is to be reviewed as
 * real sales data becomes available. Saved valuations record the version they were made with.
 */
export const MODEL_VERSION = "v1-2026-10";

/**
 * The INE median is taken as a used property in normal condition with every feature below.
 * A new property is worth more, one to recover less.
 */
export const CONDITION_FACTOR: Record<Condition, number> = {
  novo: 1.15,
  usado: 1,
  para_recuperar: 0.75,
};

/**
 * Features are not added to the price: a property without one is worth less than one with it.
 * Each applies only to the property types listed.
 */
export const MISSING_FEATURE: Record<Feature, { types: readonly PropertyType[]; penalty: number }> =
  {
    // Applied per floor from the 2nd (see missingElevatorPenalty), not as a flat rate.
    elevator: { types: ["apartamento"], penalty: 0.05 },
    garage: { types: ["apartamento", "moradia"], penalty: 0.05 },
    balcony: { types: ["apartamento"], penalty: 0.03 },
  };
/** An apartment without a lift on the 2nd floor loses 5 %, 10 % on the 3rd, 15 % from the 4th. */
export const ELEVATOR_FROM_FLOOR = 2;
export const ELEVATOR_MAX_PENALTY = 0.15;

/** Similar listings show asking prices; sales close this much lower (negotiation margin). */
export const NEGOTIATION_MARGIN = 0.1;

/** How much the similar listings weigh against the INE median, by how many have a €/m². */
export function comparablesWeight(count: number): number {
  if (count >= 5) return 0.7;
  if (count >= 3) return 0.5;
  return 0;
}

export type Confidence = "low" | "medium" | "high";

/** Half-width of the range around the likely value, and the score saved with a valuation. */
export const CONFIDENCE: Record<Confidence, { spread: number; score: number }> = {
  low: { spread: 0.15, score: 0.4 },
  medium: { spread: 0.1, score: 0.65 },
  high: { spread: 0.07, score: 0.85 },
};

/** The suggested asking price leaves this margin above the expected sale price. */
export const ASKING_MARGIN = 0.05;
