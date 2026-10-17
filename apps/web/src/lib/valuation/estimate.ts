import { median } from "../calculator/comparables";
import { FEATURES, type Comparable, type Condition, type Feature } from "../calculator/state";
import {
  ASKING_MARGIN,
  comparablesWeight,
  CONDITION_FACTOR,
  CONFIDENCE,
  ELEVATOR_FROM_FLOOR,
  ELEVATOR_MAX_PENALTY,
  MISSING_FEATURE,
  NEGOTIATION_MARGIN,
  type Confidence,
} from "./model";
import type { ValuationState } from "./state";

/** The INE median sale €/m² used as the base: the parish's, or the nearest area that has one. */
export interface IneBase {
  value: number;
  period: string;
  areaName: string;
  level: string;
  yearOnYear: number | null;
}

/** A missing feature and how much it lowers the value. */
export interface Shortfall {
  feature: Feature;
  penalty: number;
}

/** How a property's condition and features move it away from the standard (the INE median). */
export interface Adjustment {
  condition: Condition;
  conditionFactor: number;
  shortfalls: Shortfall[];
  /** Condition × each (1 − penalty). */
  factor: number;
}

export interface ComparableValue {
  /** Position in the seller's list. */
  index: number;
  /** Asking price per m². */
  askingPerM2: number;
  adjustment: Adjustment;
  /** Expected sale €/m² of a standard property, from this listing. */
  standardPerM2: number;
}

export interface Valuation {
  ine: IneBase | null;
  comparables: ComparableValue[];
  comparablesMedian: number | null;
  /** Weight of the similar listings in the base (0 with fewer than 3). */
  weight: number;
  /** Standard property €/m²: INE median and similar listings blended. */
  basePerM2: number;
  subject: Adjustment;
  perM2: number;
  likely: number;
  low: number;
  high: number;
  confidence: Confidence;
  /** Suggested asking price, above the likely value by the negotiation margin. */
  askingPrice: number;
  /** The similar listings' median asking price per m², for the advice. */
  comparablesAskingPerM2: number | null;
}

/** What the estimate needs from the property. */
type Property = Pick<ValuationState, "propertyType" | "condition" | "floor" | "features">;

/** The lift's penalty: from the 2nd floor, 5 % a floor, at most 15 %. */
export function missingElevatorPenalty(floor: number | null): number {
  if (floor === null || floor < ELEVATOR_FROM_FLOOR) return 0;
  const floors = floor - ELEVATOR_FROM_FLOOR + 1;
  return Math.min(ELEVATOR_MAX_PENALTY, floors * MISSING_FEATURE.elevator.penalty);
}

export function adjustmentFor(p: Property): Adjustment {
  const shortfalls: Shortfall[] = [];
  for (const feature of FEATURES) {
    const rule = MISSING_FEATURE[feature];
    if (p.features[feature] || !rule.types.includes(p.propertyType)) continue;
    const penalty = feature === "elevator" ? missingElevatorPenalty(p.floor) : rule.penalty;
    if (penalty > 0) shortfalls.push({ feature, penalty });
  }
  const conditionFactor = CONDITION_FACTOR[p.condition];
  return {
    condition: p.condition,
    conditionFactor,
    shortfalls,
    factor: shortfalls.reduce((f, s) => f * (1 - s.penalty), conditionFactor),
  };
}

/**
 * A similar listing as a property: what it does not say is taken as the seller's, so an unknown
 * detail neither raises nor lowers it.
 */
function comparableProperty(c: Comparable, subject: Property): Property {
  return {
    propertyType: c.propertyType,
    condition: c.condition ?? subject.condition,
    floor: c.floor ?? subject.floor,
    features: Object.fromEntries(
      FEATURES.map((k) => [k, c.features[k] ?? subject.features[k]]),
    ) as Property["features"],
  };
}

const round = (value: number, to: number) => Math.round(value / to) * to;

/**
 * The seller's property valued from the INE median of its area and the similar listings they
 * added (lib/valuation/model has every assumption). Each listing is brought to a standard
 * property: its asking price less the negotiation margin, divided by its own adjustment. The
 * standard €/m² (INE and listings blended) is then adjusted to the seller's property.
 * Null without an area in m², or with neither an INE median nor any priced listing.
 */
export function estimateValue(state: ValuationState, ine: IneBase | null): Valuation | null {
  const area = state.areaM2;
  if (!area) return null;

  const comparables = state.comparables.flatMap((c, index): ComparableValue[] => {
    if (!c.askingPrice || !c.areaM2) return [];
    const askingPerM2 = c.askingPrice / c.areaM2;
    const adjustment = adjustmentFor(comparableProperty(c, state));
    return [
      {
        index,
        askingPerM2,
        adjustment,
        standardPerM2: (askingPerM2 * (1 - NEGOTIATION_MARGIN)) / adjustment.factor,
      },
    ];
  });
  const comparablesMedian = median(comparables.map((c) => c.standardPerM2));
  const count = comparables.length;

  let weight = comparablesWeight(count);
  let basePerM2: number;
  if (ine && comparablesMedian !== null) {
    basePerM2 = (1 - weight) * ine.value + weight * comparablesMedian;
  } else if (ine) {
    basePerM2 = ine.value;
  } else if (comparablesMedian !== null) {
    weight = 1;
    basePerM2 = comparablesMedian;
  } else {
    return null;
  }

  const subject = adjustmentFor(state);
  const perM2 = basePerM2 * subject.factor;
  const exact = perM2 * area;
  const confidence: Confidence = !ine ? "low" : count >= 5 ? "high" : count >= 3 ? "medium" : "low";
  const spread = CONFIDENCE[confidence].spread;
  return {
    ine,
    comparables,
    comparablesMedian,
    weight,
    basePerM2,
    subject,
    perM2,
    likely: round(exact, 1000),
    low: round(exact * (1 - spread), 1000),
    high: round(exact * (1 + spread), 1000),
    confidence,
    askingPrice: round(exact * (1 + ASKING_MARGIN), 1000),
    comparablesAskingPerM2: median(comparables.map((c) => c.askingPerM2)),
  };
}
