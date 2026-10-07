import {
  classifyOpportunity,
  runContractAssignment,
  runFlip,
  runLongTermRental,
  runShortTermRental,
  seasonsToMonths,
  type Opportunity,
  type ParameterSet,
  type PropertyInputs,
  type ScenarioKind,
  type ScenarioResult,
} from "@olhovivo/engine";
import type { CalculatorState } from "./state";

export const SCENARIO_KINDS: ScenarioKind[] = [
  "flip",
  "longTermRental",
  "shortTermRental",
  "contractAssignment",
];

export type MissingField =
  "purchasePrice" | "resaleValue" | "monthlyRent" | "marketValue" | "nightly" | "cessao";

export type ScenarioOutcome =
  | { kind: ScenarioKind; result: ScenarioResult; missing?: never }
  | { kind: ScenarioKind; missing: MissingField[]; result?: never };

/**
 * A long-term rental is kept and let for good; profit and IRR are measured over this many years,
 * or over the loan term when it is longer, so that the loan is repaid.
 */
export const PERMANENT_RENTAL_YEARS = 30;
export const permanentRentalYears = (state: CalculatorState) =>
  Math.max(PERMANENT_RENTAL_YEARS, state.useLoan ? state.loanTermYears : 0);

export interface CalculatorOutput {
  outcomes: ScenarioOutcome[];
  opportunity: Opportunity | null;
  /** Purchase price actually used (the asking price when not set). */
  purchasePrice: number | null;
  loanAmount: number;
}

/** The most banks may lend as a share of the price (Banco de Portugal limit for the use). */
export function maxLtv(propertyUse: CalculatorState["propertyUse"], params: ParameterSet): number {
  return propertyUse === "hpp" ? params.financing.maxLtv.hpp : params.financing.maxLtv.other;
}

/** The loan used: the user's amount, or the most banks lend for the property use. */
export function effectiveLoanAmount(
  state: CalculatorState,
  purchasePrice: number,
  params: ParameterSet,
): number {
  if (!state.useLoan) return 0;
  return state.loanAmount ?? Math.round(purchasePrice * maxLtv(state.propertyUse, params));
}

const isSet = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

export interface RunOptions {
  /** Run only this deal. */
  only?: ScenarioKind;
  /**
   * Sell at this price instead of the expected one: the resale price, the short-term rental's
   * exit, the assignment price, or a sale of the long-term rental at the end of its horizon.
   */
  salePrice?: number;
}

/**
 * Runs the four scenarios from the calculator state. A scenario whose required market
 * values are missing is reported with the missing fields instead of a result.
 *
 * @param startMonth calendar month of the purchase (1–12), to align AL seasonality.
 */
export function runCalculator(
  state: CalculatorState,
  params: ParameterSet,
  startMonth: number,
  options: RunOptions = {},
): CalculatorOutput {
  const want = (kind: ScenarioKind) => !options.only || options.only === kind;
  const salePrice = options.salePrice;
  const purchasePrice = isSet(state.purchasePrice)
    ? state.purchasePrice
    : isSet(state.askingPrice)
      ? state.askingPrice
      : null;
  const loanAmount = purchasePrice ? effectiveLoanAmount(state, purchasePrice, params) : 0;
  const rentalHoldingMonths = Math.round(state.rentalYears * 12);

  const property = (
    holdingMonths: number,
    exitPrice: number | null,
    costs: { condominiumMonthly: number; insuranceAnnual: number },
  ): PropertyInputs => ({
    purchasePrice: purchasePrice!,
    propertyUse: state.propertyUse,
    vpt: isSet(state.vpt) ? state.vpt : undefined,
    imiRate: state.imiRate,
    renovationBudget: state.renovationBudget,
    renovationMonths: state.renovationMonths,
    loan:
      loanAmount > 0
        ? {
            amount: loanAmount,
            // The user enters the TAEG: the loan's costs are included in the rate.
            annualRate: state.interestRate,
            termYears: state.loanTermYears,
            rateType: "taeg",
          }
        : null,
    holdingMonths,
    exitPrice,
    sellingCommissionRate: state.sellingCommissionRate,
    valuationFee: state.valuationFee,
    processingFee: state.processingFee,
    otherTaxableIncome: state.otherTaxableIncome ?? 0,
    buyerNonResident: state.buyerNonResident,
    ...costs,
  });

  // The short-term rental is sold at the end of the holding period, at today's value (no
  // appreciation is assumed): the value after works when the user plans a renovation and gave
  // one, otherwise the current market value.
  const rentalBase =
    state.renovationBudget > 0 && isSet(state.resaleValue) ? state.resaleValue : state.marketValue;
  const rentalExit = isSet(rentalBase) ? rentalBase : 0;

  const outcomes: ScenarioOutcome[] = [];
  const missing = (...fields: (MissingField | false)[]) =>
    fields.filter((f): f is MissingField => f !== false);

  // Fix & flip
  if (want("flip")) {
    const resale = salePrice ?? state.resaleValue;
    const m = missing(!purchasePrice && "purchasePrice", !isSet(resale) && "resaleValue");
    outcomes.push(
      m.length
        ? { kind: "flip", missing: m }
        : {
            kind: "flip",
            result: runFlip(
              {
                ...property(state.flipMonths, resale!, {
                  condominiumMonthly: state.condominiumMonthly,
                  insuranceAnnual: state.insuranceAnnual,
                }),
                // Utilities while holding the property for resale are not counted.
                utilitiesMonthly: 0,
              },
              params,
            ),
          },
    );
  }

  // Long-term rental
  if (want("longTermRental")) {
    const m = missing(
      !purchasePrice && "purchasePrice",
      !isSet(state.monthlyRent) && "monthlyRent",
    );
    outcomes.push(
      m.length
        ? { kind: "longTermRental", missing: m }
        : {
            kind: "longTermRental",
            result: runLongTermRental(
              {
                // Let for good: no sale, measured over PERMANENT_RENTAL_YEARS (or a sale at its
                // end, when a sale price is asked for).
                ...property(permanentRentalYears(state) * 12, salePrice ?? null, {
                  condominiumMonthly: state.rentalCondominiumMonthly,
                  insuranceAnnual: state.rentalInsuranceMonthly * 12,
                }),
                monthlyRent: state.monthlyRent!,
                rentGrowthRate: state.rentGrowthRate,
                // Leases follow one another, with the vacancy between them.
                contractMonths: state.contractYears * 12,
                vacancyMonths: state.vacancyMonths,
                maintenanceRate: state.maintenanceRate,
                managementRate: state.managementRate,
                rentalTax:
                  state.rentalTaxMode === "marginal"
                    ? { mode: "marginal" }
                    : { mode: "autonomous", contractYears: state.contractYears },
              },
              params,
            ),
          },
    );
  }

  // Short-term rental
  if (want("shortTermRental")) {
    const exit = salePrice ?? rentalExit;
    const seasons = [state.nightlyRate, state.occupancy].flatMap((s) => [s.high, s.mid, s.low]);
    const m = missing(
      !purchasePrice && "purchasePrice",
      !seasons.every((v) => v !== null && v >= 0) && "nightly",
      salePrice === undefined && !isSet(rentalBase) && "marketValue",
    );
    if (m.length) {
      outcomes.push({ kind: "shortTermRental", missing: m });
    } else {
      const result = runShortTermRental(
        {
          ...property(rentalHoldingMonths, exit, {
            condominiumMonthly: state.alCondominiumMonthly,
            insuranceAnnual: state.alInsuranceAnnual,
          }),
          adr: seasonsToMonths(state.nightlyRate as { high: number; mid: number; low: number }),
          occupancy: seasonsToMonths(state.occupancy as { high: number; mid: number; low: number }),
          adrGrowthRate: state.nightlyGrowthRate,
          startMonth,
          averageStayNights: state.averageStayNights,
          cleaningFeePerStay: state.cleaningFeePerStay,
          cleaningCostPerStay: state.cleaningCostPerStay,
          platformFeeRate: state.alPlatformFeeRate,
          managementRate: state.alManagementRate,
          maintenanceRate: state.alMaintenanceRate,
          utilitiesMonthly: state.alUtilitiesMonthly,
          consumablesPerNight: state.consumablesPerNight,
          furnishingCost: state.furnishingCost,
          registrationCost: state.alRegistrationCost,
          // The AL registry check is a later phase (WBS 5.3.4).
          alStatus: "unknown",
          vatRegistered: state.vatRegistered,
        },
        params,
      );
      result.warnings = result.warnings.filter((w) => w !== "al_status_unknown");
      outcomes.push({ kind: "shortTermRental", result });
    }
  }

  // Contract assignment
  if (want("contractAssignment")) {
    const cpcvPrice = isSet(state.cpcvPrice) ? state.cpcvPrice : purchasePrice;
    const assignmentPrice = salePrice ?? state.assignmentPrice;
    const m = missing(
      !(cpcvPrice && isSet(state.deposit) && isSet(assignmentPrice)) && "cessao",
      !isSet(state.marketValue) && "marketValue",
    );
    outcomes.push(
      m.length
        ? { kind: "contractAssignment", missing: m }
        : {
            kind: "contractAssignment",
            result: runContractAssignment(
              {
                cpcvPrice: cpcvPrice!,
                deposit: state.deposit!,
                assignmentMonth: state.assignmentMonths,
                assignmentPrice: assignmentPrice!,
                // Today's value: no appreciation is assumed.
                marketValueAtAssignment: state.marketValue!,
                commissionRate: state.assignmentCommissionRate,
                otherCosts: state.assignmentOtherCosts,
                upfrontTransferTaxes: state.upfrontTransferTaxes,
                propertyUse: state.propertyUse,
                vpt: isSet(state.vpt) ? state.vpt : undefined,
                otherTaxableIncome: state.otherTaxableIncome ?? 0,
                buyerNonResident: state.buyerNonResident,
              },
              params,
            ),
          },
    );
  }

  return {
    outcomes,
    opportunity:
      isSet(state.askingPrice) && isSet(state.marketValue)
        ? classifyOpportunity(state.askingPrice, state.marketValue)
        : null,
    purchasePrice,
    loanAmount,
  };
}

/** The outcomes of the deals the user chose; all of them for scenarios saved before choosing. */
export function chosenOutcomes(output: CalculatorOutput, deals: ScenarioKind[]): ScenarioOutcome[] {
  return deals.length > 0 ? output.outcomes.filter((o) => deals.includes(o.kind)) : output.outcomes;
}
