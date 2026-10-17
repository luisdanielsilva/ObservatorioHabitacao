import {
  CONDITIONS,
  FEATURES,
  MAX_COMPARABLES,
  normaliseComparables,
  normaliseFloor,
  PROPERTY_TYPES,
  type Comparable,
  type Condition,
  type Feature,
  type PropertyType,
} from "../calculator/state";

/**
 * A seller's property and sale (Vender). `null` means not entered. Rates are fractions.
 * Only the property is required; the sale details are needed for what the seller keeps.
 */
export interface ValuationState {
  // 1. The property
  areaId: number | null;
  mapsUrl: string;
  propertyType: PropertyType;
  bedrooms: number | null;
  areaM2: number | null;
  condition: Condition;
  /** Floor of an apartment: 0 is the ground floor. */
  floor: number | null;
  features: Record<Feature, boolean>;

  // 2. Similar listings
  comparables: Comparable[];

  // 3. The sale (optional)
  /** The price the seller expects; empty uses the likely value. */
  salePrice: number | null;
  /** Agency commission, excluding VAT; 0 when selling without an agency. */
  sellingCommissionRate: number;
  /** E.g. the energy certificate. */
  otherSaleCosts: number | null;
  purchasePrice: number | null;
  purchaseYear: number | null;
  /** IMT, stamp duty, deed and registration paid when buying. */
  purchaseCosts: number | null;
  /** Works in the last 12 years, with invoices. */
  works: number | null;
  /** The seller's own permanent home (habitação própria e permanente). */
  ownHome: boolean;
  /** Amount reinvested in a new own permanent home (or planned). */
  reinvestment: number | null;
  /** Loan still owed on the property, repaid with the sale. */
  loanBalance: number | null;
  /** Early repayment fee on the loan repaid (legal maximum: 0.5 % variable, 2 % fixed rate). */
  earlyRepaymentRate: number;
  /** The seller's other taxable income in the year, to find the IRS bracket. */
  otherTaxableIncome: number | null;
}

/** Default commission, excluding VAT (the usual 5 %, often negotiable). */
export const DEFAULT_SELLING_COMMISSION = 0.05;
export const DEFAULT_EARLY_REPAYMENT = 0.005;
/** Years accepted for the purchase (gains on homes bought before 1989 are not taxed). */
export const MIN_PURCHASE_YEAR = 1900;

export function initialValuation(overrides: Partial<ValuationState> = {}): ValuationState {
  return {
    areaId: null,
    mapsUrl: "",
    propertyType: "apartamento",
    bedrooms: null,
    areaM2: null,
    condition: "usado",
    floor: null,
    features: { elevator: false, garage: false, balcony: false },
    comparables: [],
    salePrice: null,
    sellingCommissionRate: DEFAULT_SELLING_COMMISSION,
    otherSaleCosts: null,
    purchasePrice: null,
    purchaseYear: null,
    purchaseCosts: null,
    works: null,
    ownHome: false,
    reinvestment: null,
    loanBalance: null,
    earlyRepaymentRate: DEFAULT_EARLY_REPAYMENT,
    otherTaxableIncome: null,
    ...overrides,
  };
}

/** The sale step has something the seller entered: what they keep is shown. */
export function hasSaleDetails(s: ValuationState): boolean {
  return s.salePrice !== null || s.purchasePrice !== null || s.loanBalance !== null;
}

/** Rebuilds a valuation from untrusted JSON (a draft or a saved one), validating every value. */
export function normaliseValuation(raw: unknown): ValuationState {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base = initialValuation();
  const amount = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, 1e9) : null;
  const rate = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fallback;
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  const features = (s.features ?? {}) as Record<string, unknown>;
  const year = s.purchaseYear;
  const areaId = s.areaId;
  const bedrooms = s.bedrooms;
  return {
    areaId: typeof areaId === "number" && Number.isInteger(areaId) && areaId > 0 ? areaId : null,
    mapsUrl: typeof s.mapsUrl === "string" ? s.mapsUrl.slice(0, 2000) : "",
    propertyType: oneOf(s.propertyType, PROPERTY_TYPES, base.propertyType),
    bedrooms:
      typeof bedrooms === "number" && Number.isInteger(bedrooms) && bedrooms >= 0
        ? Math.min(5, bedrooms)
        : null,
    areaM2: amount(s.areaM2) || null,
    condition: oneOf(s.condition, CONDITIONS, base.condition),
    floor: normaliseFloor(s.floor),
    features: Object.fromEntries(
      FEATURES.map((k) => [k, features[k] === true]),
    ) as ValuationState["features"],
    comparables: normaliseComparables(s.comparables).slice(0, MAX_COMPARABLES),
    salePrice: amount(s.salePrice) || null,
    sellingCommissionRate: rate(s.sellingCommissionRate, base.sellingCommissionRate),
    otherSaleCosts: amount(s.otherSaleCosts),
    purchasePrice: amount(s.purchasePrice) || null,
    purchaseYear:
      typeof year === "number" &&
      Number.isInteger(year) &&
      year >= MIN_PURCHASE_YEAR &&
      year <= new Date().getFullYear()
        ? year
        : null,
    purchaseCosts: amount(s.purchaseCosts),
    works: amount(s.works),
    ownHome: s.ownHome === true,
    reinvestment: amount(s.reinvestment),
    loanBalance: amount(s.loanBalance),
    earlyRepaymentRate: rate(s.earlyRepaymentRate, base.earlyRepaymentRate),
    otherTaxableIncome: amount(s.otherTaxableIncome),
  };
}
