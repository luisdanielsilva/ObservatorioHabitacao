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
 * - marginal: added to other income (englobamento) at the investor's marginal rate
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

/** Income tax rate on rental income for the chosen tax mode. */
export function rentalIncomeTaxRate(
  tax: RentalTax,
  params: ParameterSet,
  marginalTaxRate: number,
): number {
  if (tax.mode === "marginal") return marginalTaxRate;
  const reduced = params.rentalIncome.longContractRates
    .filter((r) => tax.contractYears >= r.minYears)
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
  const taxRate = rentalIncomeTaxRate(input.rentalTax, params, input.marginalTaxRate);

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
    incomeTax: (block) => Math.max(0, sum(block.map((o) => o.income - o.costs))) * taxRate,
  });

  return summarise("longTermRental", sim, input.loan?.amount ?? 0, {
    grossAnnualIncome: input.monthlyRent * 12,
    acquisitionCost: input.purchasePrice + sim.acquisition.total,
  });
}
