import type { ScenarioKind, ScenarioResult } from "@observatorio-habitacao/engine";

export const COST_ITEMS = ["imi", "condominium", "insurance", "maintenance"] as const;
export type CostItem = (typeof COST_ITEMS)[number];

/** The recurring costs of owning the property, as shown for a deal. */
export interface OwnershipCosts {
  /** Resale: the months until the sale, which the costs cover; null for a year (rentals). */
  months: number | null;
  items: Partial<Record<CostItem, number>>;
  total: number;
}

/**
 * IMI, condominium and insurance (and maintenance, for rentals). A resale pays them only for
 * the months until the sale, as in its calculation; rentals show a typical year.
 */
export function ownershipCosts(kind: ScenarioKind, result: ScenarioResult): OwnershipCosts | null {
  const fixed = result.annualFixedCosts;
  if (!fixed) return null;
  const months = kind === "flip" ? Math.max(0, result.months.length - 1) : null;
  const share = months === null ? 1 : months / 12;
  const items: OwnershipCosts["items"] = {
    imi: fixed.imi * share,
    condominium: fixed.condominium * share,
    insurance: fixed.insurance * share,
    ...(result.annualMaintenance ? { maintenance: result.annualMaintenance } : {}),
  };
  const total = Object.values(items).reduce((sum, v) => sum + v, 0);
  return { months, items, total };
}
