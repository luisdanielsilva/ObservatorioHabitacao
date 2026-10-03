import type { Goal, Seasonal } from "@olhovivo/engine";

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
  /** null = 70 % of the purchase price. */
  loanAmount: number | null;
  interestRate: number;
  loanTermYears: number;
  flipMonths: number;
  rentalYears: number;
  marginalTaxRate: number;
  rentalTaxMode: "autonomous" | "marginal";
  contractYears: number;

  // Assumptions (WBS 2.3.2 defaults, editable)
  imiRate: number;
  vpt: number | null;
  condominiumMonthly: number;
  insuranceAnnual: number;
  utilitiesMonthly: number;
  sellingCommissionRate: number;
  appreciationRate: number;
  rentGrowthRate: number;
  vacancyRate: number;
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

  goal: Goal;
}

/** Share of the purchase price borrowed when the user has not set a loan amount. */
export const DEFAULT_LTV = 0.7;
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
    useLoan: true,
    loanAmount: null,
    interestRate: FALLBACK_INTEREST_RATE,
    loanTermYears: 30,
    flipMonths: 12,
    rentalYears: 10,
    marginalTaxRate: 0.35,
    rentalTaxMode: "autonomous",
    contractYears: 3,

    imiRate: FALLBACK_IMI_RATE,
    vpt: null,
    condominiumMonthly: 50,
    insuranceAnnual: 250,
    utilitiesMonthly: 50,
    sellingCommissionRate: 0.05,
    appreciationRate: 0.03,
    rentGrowthRate: 0.02,
    vacancyRate: 1 / 12,
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

    goal: "profit",
    ...overrides,
  };
}
