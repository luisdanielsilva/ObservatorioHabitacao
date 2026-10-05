import { irsOnExtraIncome } from "../tax";
import type { ParameterSet } from "../params";
import {
  fixedCostsMonthly,
  simulate,
  summarise,
  sum,
  type OperatingMonth,
  type PropertyInputs,
  type ScenarioResult,
} from "../simulation";

/**
 * How category F rental income is taxed:
 * - autonomous: the special flat rate, reduced for long contracts
 * - marginal: added to the investor's other income (englobamento), at the progressive IRS rates
 */
export type RentalTax = { mode: "autonomous"; contractYears: number } | { mode: "marginal" };

/** Long-term rental (arrendamento). */
export interface LongTermRentalInputs extends PropertyInputs {
  monthlyRent: number;
  /** Annual rent increase, applied every 12 months of letting. */
  rentGrowthRate: number;
  /** Share of the year the property is empty, e.g. 1/12. */
  vacancyRate: number;
  /** Maintenance as a share of collected rent. */
  maintenanceRate: number;
  /** Property management fee as a share of collected rent. */
  managementRate: number;
  rentalTax: RentalTax;
}

/** The flat rate on rental income for a contract of the given length (CIRS art. 72). */
export function rentalIncomeTaxRate(contractYears: number, params: ParameterSet): number {
  const reduced = params.rentalIncome.longContractRates
    .filter((r) => contractYears >= r.minYears)
    .sort((a, b) => b.minYears - a.minYears)[0];
  return reduced?.rate ?? params.rentalIncome.autonomousRate;
}

/**
 * Long-term rental. No rent during renovation. Operating costs (IMI, condominium,
 * insurance, maintenance, management) are deductible from rental income; loan interest is
 * not (CIRS art. 41).
 */
export function runLongTermRental(
  input: LongTermRentalInputs,
  params: ParameterSet,
): ScenarioResult {
  const fixed = fixedCostsMonthly(input);
  const renovationMonths = Math.max(0, Math.round(input.renovationMonths));
  const rentalTax = input.rentalTax;
  // One year of net rent: at the flat rate, or added to the investor's other income.
  const taxOnNetRent = (net: number) =>
    rentalTax.mode === "marginal"
      ? irsOnExtraIncome(input.otherTaxableIncome, net, params)
      : Math.max(0, net) * rentalIncomeTaxRate(rentalTax.contractYears, params);

  const operating = (m: number): OperatingMonth => {
    if (m <= renovationMonths) return { income: 0, costs: fixed };
    const yearOfLetting = Math.floor((m - renovationMonths - 1) / 12);
    const rent =
      input.monthlyRent * (1 + input.rentGrowthRate) ** yearOfLetting * (1 - input.vacancyRate);
    return {
      income: rent,
      costs: fixed + rent * (input.maintenanceRate + input.managementRate),
    };
  };

  const sim = simulate({
    input,
    params,
    operating,
    incomeTax: (block) => taxOnNetRent(sum(block.map((o) => o.income - o.costs))),
  });

  return summarise("longTermRental", sim, input.loan?.amount ?? 0, {
    grossAnnualIncome: input.monthlyRent * 12,
    acquisitionCost: input.purchasePrice + sim.acquisition.total,
  });
}
