import type { ScenarioKind, Seasonal } from "@olhovivo/engine";

export const PROPERTY_TYPES = [
  "apartamento",
  "moradia",
  "terreno",
  "loja",
  "armazem",
  "escritorio",
  "outro",
] as const;
export const CONDITIONS = ["novo", "usado", "para_recuperar"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type Condition = (typeof CONDITIONS)[number];

/** `null` means the user has not entered a value. Rates are fractions (0.05 = 5 %). */
export interface CalculatorState {
  /** The deals the user is evaluating, in the order of SCENARIO_KINDS; empty until chosen. */
  deals: ScenarioKind[];

  // 1. Property
  url: string;
  areaId: number | null;
  address: string;
  propertyType: PropertyType;
  bedrooms: number | null;
  areaM2: number | null;
  condition: Condition;
  askingPrice: number | null;
  extras: { garage: boolean; elevator: boolean; balcony: boolean; pool: boolean };

  // 2. Market values, entered by the user
  marketValue: number | null;
  resaleValue: number | null;
  monthlyRent: number | null;
  nightlyRate: Seasonal<number | null>;
  occupancy: Seasonal<number | null>;
  cpcvPrice: number | null;
  deposit: number | null;
  assignmentPrice: number | null;
  assignmentMonths: number;
  upfrontTransferTaxes: boolean;

  // 3. Purchase and financing
  purchasePrice: number | null;
  propertyUse: "secondary" | "hpp";
  renovationBudget: number;
  renovationMonths: number;
  useLoan: boolean;
  /** null = the most banks lend for the property use (maxLtv in the parameter set). */
  loanAmount: number | null;
  interestRate: number;
  loanTermYears: number;
  flipMonths: number;
  rentalYears: number;
  /**
   * Other annual taxable income (salaries, pensions…). Gains and short-term rental income are
   * added to it and taxed at the IRS brackets. null = not given, taken as 0.
   */
  otherTaxableIncome: number | null;
  buyerNonResident: boolean;
  rentalTaxMode: "autonomous" | "marginal";
  contractYears: number;

  // Assumptions (WBS 2.3.2 defaults, editable)
  imiRate: number;
  vpt: number | null;
  /** Bank fees at signing, when there is a loan. */
  valuationFee: number;
  processingFee: number;
  // Condominium and insurance, separately for each deal.
  condominiumMonthly: number;
  insuranceAnnual: number;
  rentalCondominiumMonthly: number;
  rentalInsuranceMonthly: number;
  alCondominiumMonthly: number;
  alInsuranceAnnual: number;
  sellingCommissionRate: number;
  rentGrowthRate: number;
  /** Months empty between one lease and the next. */
  vacancyMonths: number;
  /** Yearly increase of the nightly rate (short-term rental). */
  nightlyGrowthRate: number;
  maintenanceRate: number;
  managementRate: number;
  alPlatformFeeRate: number;
  alManagementRate: number;
  alUtilitiesMonthly: number;
  averageStayNights: number;
  cleaningFeePerStay: number;
  cleaningCostPerStay: number;
  consumablesPerNight: number;
  furnishingCost: number;
  alRegistrationCost: number;
  vatRegistered: boolean;
  assignmentCommissionRate: number;
  assignmentOtherCosts: number;
}

/**
 * Used when no published rent update coefficient is available; normally the latest one
 * (reference rate "rent_update") is the default.
 */
export const FALLBACK_RENT_UPDATE = 0.0224;
/** Loan term: 30 years by default, up to 50. */
export const DEFAULT_LOAN_TERM_YEARS = 30;
export const MAX_LOAN_TERM_YEARS = 50;
/** Used when no Euribor value is available. */
export const FALLBACK_INTEREST_RATE = 0.035;
/** Used when the municipality's IMI rate is unknown (the legal range is 0.3 %–0.45 %). */
export const FALLBACK_IMI_RATE = 0.003;

/**
 * Starting values. Market values are deliberately empty: in v1 the user provides them.
 * The other defaults are typical figures documented in packages/engine/METHODOLOGY.md.
 */
export function initialState(overrides: Partial<CalculatorState> = {}): CalculatorState {
  return {
    deals: [],
    url: "",
    areaId: null,
    address: "",
    propertyType: "apartamento",
    bedrooms: null,
    areaM2: null,
    condition: "usado",
    askingPrice: null,
    extras: { garage: false, elevator: false, balcony: false, pool: false },

    marketValue: null,
    resaleValue: null,
    monthlyRent: null,
    nightlyRate: { high: null, mid: null, low: null },
    occupancy: { high: null, mid: null, low: null },
    cpcvPrice: null,
    deposit: null,
    assignmentPrice: null,
    assignmentMonths: 6,
    upfrontTransferTaxes: false,

    purchasePrice: null,
    propertyUse: "secondary",
    renovationBudget: 0,
    renovationMonths: 0,
    // By default the buyer pays with their own money; financing is opt-in.
    useLoan: false,
    loanAmount: null,
    interestRate: FALLBACK_INTEREST_RATE,
    loanTermYears: DEFAULT_LOAN_TERM_YEARS,
    flipMonths: 12,
    rentalYears: 10,
    otherTaxableIncome: null,
    buyerNonResident: false,
    rentalTaxMode: "autonomous",
    contractYears: 3,

    imiRate: FALLBACK_IMI_RATE,
    vpt: null,
    valuationFee: 250,
    processingFee: 300,
    condominiumMonthly: 50,
    insuranceAnnual: 250,
    rentalCondominiumMonthly: 25,
    rentalInsuranceMonthly: 20,
    alCondominiumMonthly: 50,
    alInsuranceAnnual: 250,
    sellingCommissionRate: 0.05,
    rentGrowthRate: FALLBACK_RENT_UPDATE,
    vacancyMonths: 1,
    nightlyGrowthRate: 0.02,
    maintenanceRate: 0.05,
    managementRate: 0,
    alPlatformFeeRate: 0.15,
    alManagementRate: 0.2,
    alUtilitiesMonthly: 150,
    averageStayNights: 3,
    cleaningFeePerStay: 40,
    cleaningCostPerStay: 35,
    consumablesPerNight: 4,
    furnishingCost: 10_000,
    alRegistrationCost: 1_000,
    vatRegistered: false,
    assignmentCommissionRate: 0.05,
    assignmentOtherCosts: 1_000,

    ...overrides,
  };
}

const ENUMS: Partial<Record<keyof CalculatorState, readonly string[]>> = {
  propertyType: PROPERTY_TYPES,
  condition: CONDITIONS,
  propertyUse: ["secondary", "hpp"],
  rentalTaxMode: ["autonomous", "marginal"],
};

/** Fields that may be null (not entered) in addition to their number type. */
const isNullableNumber = (defaultValue: unknown) => defaultValue === null;

function normaliseValue(raw: unknown, fallback: unknown, allowed?: readonly string[]): unknown {
  if (allowed) return typeof raw === "string" && allowed.includes(raw) ? raw : fallback;
  if (isNullableNumber(fallback)) {
    return raw === null || (typeof raw === "number" && Number.isFinite(raw)) ? raw : null;
  }
  if (typeof fallback === "number") {
    return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  }
  if (typeof fallback === "boolean" || typeof fallback === "string") {
    return typeof raw === typeof fallback ? raw : fallback;
  }
  if (fallback && typeof fallback === "object") {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return Object.fromEntries(
      Object.entries(fallback).map(([k, v]) => [k, normaliseValue(source[k], v)]),
    );
  }
  return fallback;
}

/**
 * Rebuilds a calculator state from untrusted data (saved JSON, a request body): unknown keys are
 * dropped and every value must have the expected type, otherwise the default is used. Strings
 * are capped so that stored scenarios stay small.
 */
export const DEAL_KINDS: readonly ScenarioKind[] = [
  "flip",
  "longTermRental",
  "shortTermRental",
  "contractAssignment",
];

/** Known deal kinds, without repeats, in the canonical order. */
export function normaliseDeals(raw: unknown): ScenarioKind[] {
  const list = Array.isArray(raw) ? raw : [];
  return DEAL_KINDS.filter((k) => list.includes(k));
}

export function normaliseState(raw: unknown): CalculatorState {
  const defaults = initialState();
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const state = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      key === "areaId"
        ? normaliseValue(source[key], null)
        : normaliseValue(source[key], fallback, ENUMS[key as keyof CalculatorState]),
    ]),
  ) as unknown as CalculatorState;
  // Scenarios saved before several deals could be chosen have a single `deal`.
  state.deals = normaliseDeals(source.deals ?? (source.deal ? [source.deal] : []));
  state.url = state.url.slice(0, 2000);
  state.address = state.address.slice(0, 300);
  return state;
}
