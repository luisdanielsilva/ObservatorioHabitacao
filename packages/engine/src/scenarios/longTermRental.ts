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
  /** Length of each lease; leases follow one another for as long as the property is held. */
  contractMonths: number;
  /** Months empty between the end of one lease and the start of the next. */
  vacancyMonths: number;
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

  const contractMonths = Math.max(1, Math.round(input.contractMonths));
  const vacancyMonths = Math.max(0, Math.round(input.vacancyMonths));
  const cycle = contractMonths + vacancyMonths;
  const withCosts = (rent: number): OperatingMonth => ({
    income: rent,
    costs: fixed + rent * (input.maintenanceRate + input.managementRate),
  });

  // Leases follow one another, each followed by the vacancy before the next tenant.
  const operating = (m: number): OperatingMonth => {
    if (m <= renovationMonths) return { income: 0, costs: fixed };
    const letting = m - renovationMonths - 1;
    const vacant = letting % cycle >= contractMonths;
    const rent = input.monthlyRent * (1 + input.rentGrowthRate) ** Math.floor(letting / 12);
    return withCosts(vacant ? 0 : rent);
  };

  // A typical year: the first year's rent, spread over a whole lease-and-vacancy cycle.
  const averageRent = (input.monthlyRent * contractMonths) / cycle;
  const typicalYear = Array.from({ length: 12 }, () => withCosts(averageRent));

  const sim = simulate({
    input,
    params,
    operating,
    incomeTax: (block) => taxOnNetRent(sum(block.map((o) => o.income - o.costs))),
    typicalYear,
  });

  const result = summarise("longTermRental", sim, input.loan?.amount ?? 0, {
    grossAnnualIncome: input.monthlyRent * 12,
    acquisitionCost: input.purchasePrice + sim.acquisition.total,
  });
  result.annualMaintenance = averageRent * 12 * input.maintenanceRate;
  return result;
}
