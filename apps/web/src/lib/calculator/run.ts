import {
  classifyOpportunity,
  compareScenarios,
  runContractAssignment,
  runFlip,
  runLongTermRental,
  runShortTermRental,
  seasonsToMonths,
  type Comparison,
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

export interface CalculatorOutput {
  outcomes: ScenarioOutcome[];
  comparison: Comparison;
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
): CalculatorOutput {
  const purchasePrice = isSet(state.purchasePrice)
    ? state.purchasePrice
    : isSet(state.askingPrice)
      ? state.askingPrice
      : null;
  const loanAmount = purchasePrice ? effectiveLoanAmount(state, purchasePrice, params) : 0;
  const rentalHoldingMonths = Math.round(state.rentalYears * 12);

  const property = (holdingMonths: number, exitPrice: number): PropertyInputs => ({
    purchasePrice: purchasePrice!,
    propertyUse: state.propertyUse,
    vpt: isSet(state.vpt) ? state.vpt : undefined,
    imiRate: state.imiRate,
    renovationBudget: state.renovationBudget,
    renovationMonths: state.renovationMonths,
    loan:
      loanAmount > 0
        ? { amount: loanAmount, annualRate: state.interestRate, termYears: state.loanTermYears }
        : null,
    holdingMonths,
    exitPrice,
    sellingCommissionRate: state.sellingCommissionRate,
    otherTaxableIncome: state.otherTaxableIncome ?? 0,
    buyerNonResident: state.buyerNonResident,
    condominiumMonthly: state.condominiumMonthly,
    insuranceAnnual: state.insuranceAnnual,
  });

  // Rentals are sold at the end of the holding period, at today's value (no appreciation is
  // assumed): the value after works when the user plans a renovation and gave one, otherwise
  // the current market value.
  const rentalBase =
    state.renovationBudget > 0 && isSet(state.resaleValue) ? state.resaleValue : state.marketValue;
  const rentalExit = isSet(rentalBase) ? rentalBase : 0;

  const outcomes: ScenarioOutcome[] = [];
  const missing = (...fields: (MissingField | false)[]) =>
    fields.filter((f): f is MissingField => f !== false);

  // Fix & flip
  {
    const m = missing(
      !purchasePrice && "purchasePrice",
      !isSet(state.resaleValue) && "resaleValue",
    );
    outcomes.push(
      m.length
        ? { kind: "flip", missing: m }
        : {
            kind: "flip",
            result: runFlip(
              {
                ...property(state.flipMonths, state.resaleValue!),
                utilitiesMonthly: state.utilitiesMonthly,
              },
              params,
            ),
          },
    );
  }

  // Long-term rental
  {
    const m = missing(
      !purchasePrice && "purchasePrice",
      !isSet(state.monthlyRent) && "monthlyRent",
      !isSet(rentalBase) && "marketValue",
    );
    outcomes.push(
      m.length
        ? { kind: "longTermRental", missing: m }
        : {
            kind: "longTermRental",
            result: runLongTermRental(
              {
                ...property(rentalHoldingMonths, rentalExit),
                monthlyRent: state.monthlyRent!,
                rentGrowthRate: state.rentGrowthRate,
                vacancyRate: state.vacancyRate,
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
  {
    const seasons = [state.nightlyRate, state.occupancy].flatMap((s) => [s.high, s.mid, s.low]);
    const m = missing(
      !purchasePrice && "purchasePrice",
      !seasons.every((v) => v !== null && v >= 0) && "nightly",
      !isSet(rentalBase) && "marketValue",
    );
    if (m.length) {
      outcomes.push({ kind: "shortTermRental", missing: m });
    } else {
      const result = runShortTermRental(
        {
          ...property(rentalHoldingMonths, rentalExit),
          adr: seasonsToMonths(state.nightlyRate as { high: number; mid: number; low: number }),
          occupancy: seasonsToMonths(state.occupancy as { high: number; mid: number; low: number }),
          adrGrowthRate: state.rentGrowthRate,
          startMonth,
          averageStayNights: state.averageStayNights,
          cleaningFeePerStay: state.cleaningFeePerStay,
          cleaningCostPerStay: state.cleaningCostPerStay,
          platformFeeRate: state.alPlatformFeeRate,
          managementRate: state.alManagementRate,
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
  {
    const cpcvPrice = isSet(state.cpcvPrice) ? state.cpcvPrice : purchasePrice;
    const m = missing(
      !(cpcvPrice && isSet(state.deposit) && isSet(state.assignmentPrice)) && "cessao",
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
                assignmentPrice: state.assignmentPrice!,
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

  const results = outcomes.flatMap((o) => (o.result ? [o.result] : []));
  return {
    outcomes,
    comparison: compareScenarios(results, state.goal),
    opportunity:
      isSet(state.askingPrice) && isSet(state.marketValue)
        ? classifyOpportunity(state.askingPrice, state.marketValue)
        : null,
    purchasePrice,
    loanAmount,
  };
}
