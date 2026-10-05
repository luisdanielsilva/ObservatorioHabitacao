import type { ParameterSet } from "../params";

/**
 * Test parameters: mainland Portugal, 2025.
 *
 * NOT VERIFIED by an accountant or tax advisor (WBS 2.3.1 / 10.6). Tax figures are from
 * public 2025 sources as understood by the developers; transaction fees and LTV limits are
 * typical values. Used only by tests — the app loads its parameters from the database.
 */
export const params2025: ParameterSet = {
  year: 2025,
  region: "continente",
  imt: {
    hpp: [
      { upTo: 104_261, rate: 0, deduction: 0 },
      { upTo: 142_618, rate: 0.02, deduction: 2_085.22 },
      { upTo: 194_458, rate: 0.05, deduction: 6_363.76 },
      { upTo: 324_058, rate: 0.07, deduction: 10_252.92 },
      { upTo: 648_022, rate: 0.08, deduction: 13_493.5 },
      { upTo: 1_128_287, rate: 0.06, deduction: 0 },
      { upTo: null, rate: 0.075, deduction: 0 },
    ],
    secondary: [
      { upTo: 104_261, rate: 0.01, deduction: 0 },
      { upTo: 142_618, rate: 0.02, deduction: 1_042.61 },
      { upTo: 194_458, rate: 0.05, deduction: 5_321.15 },
      { upTo: 324_058, rate: 0.07, deduction: 9_210.31 },
      // Other housing: the 8 % bracket ends lower than for own permanent home (CIMT art. 17).
      { upTo: 621_501, rate: 0.08, deduction: 12_450.89 },
      { upTo: 1_128_287, rate: 0.06, deduction: 0 },
      { upTo: null, rate: 0.075, deduction: 0 },
    ],
    otherUrbanRate: 0.065,
    rusticRate: 0.05,
  },
  stampDuty: { purchaseRate: 0.008, loanRate: 0.006, interestRate: 0.04 },
  transactionFees: { deedAndRegistry: 375, deedAndRegistryWithMortgage: 700 },
  financing: {
    maxLtv: { hpp: 0.9, other: 0.8 },
    earlyRepaymentFeeRate: 0.005,
    typicalSpread: 0.01,
  },
  vatRate: 0.23,
  rentalIncome: {
    autonomousRate: 0.25,
    longContractRates: [
      { minYears: 5, rate: 0.15 },
      { minYears: 10, rate: 0.1 },
      { minYears: 20, rate: 0.05 },
    ],
  },
  localAccommodation: {
    coefficient: 0.35,
    containmentZoneCoefficient: 0.5,
    vatRate: 0.06,
    vatExemptionThreshold: 15_000,
  },
  // CIRS art. 68 as amended by Lei 55-A/2025 (2025 income); art. 68-A.
  irs: {
    brackets: [
      { upTo: 8059, rate: 0.125 },
      { upTo: 12160, rate: 0.16 },
      { upTo: 17233, rate: 0.215 },
      { upTo: 22306, rate: 0.244 },
      { upTo: 28400, rate: 0.314 },
      { upTo: 41629, rate: 0.349 },
      { upTo: 44987, rate: 0.431 },
      { upTo: 83696, rate: 0.446 },
      { upTo: null, rate: 0.48 },
    ],
    solidarity: [
      { over: 80000, rate: 0.025 },
      { over: 250000, rate: 0.05 },
    ],
  },
  capitalGains: { inclusionRate: 0.5 },
  contractAssignment: { inclusionRate: 0.5 },
};
