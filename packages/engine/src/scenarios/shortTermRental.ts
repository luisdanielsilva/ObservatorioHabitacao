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
 * Whether new AL registrations are possible where the property is:
 * - allowed: no restrictions
 * - containment: containment zone (restricted, higher taxable coefficient)
 * - suspended: new registrations suspended by the municipality
 */
export type AlRegistrationStatus = "allowed" | "containment" | "suspended" | "unknown";

/** Short-term rental (alojamento local). */
export interface ShortTermRentalInputs extends PropertyInputs {
  /** Average daily rate per calendar month, January to December. */
  adr: readonly number[];
  /** Occupancy (0–1) per calendar month, January to December. */
  occupancy: readonly number[];
  /** Annual ADR increase. */
  adrGrowthRate: number;
  /** Calendar month of the purchase (1 = January), to align seasonality. */
  startMonth: number;
  averageStayNights: number;
  /** Cleaning fee charged to guests per stay. */
  cleaningFeePerStay: number;
  /** What each cleaning costs the owner. */
  cleaningCostPerStay: number;
  /** Platform commission on bookings (e.g. Airbnb, Booking). */
  platformFeeRate: number;
  /** Management fee on income. */
  managementRate: number;
  /** Maintenance and repairs as a share of income (more wear than a long-term let). */
  maintenanceRate: number;
  utilitiesMonthly: number;
  /** Linen, toiletries, welcome items. */
  consumablesPerNight: number;
  furnishingCost: number;
  /** One-off AL registration and compliance costs (licence, safety equipment). */
  registrationCost: number;
  alStatus: AlRegistrationStatus;
  /** Whether the owner charges VAT on stays (not exempt under CIVA art. 53). */
  vatRegistered: boolean;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Short-term rental, with monthly seasonality. Income is taxed in category B under the
 * simplified regime: a coefficient of gross income is added to the investor's other income
 * and taxed at the progressive IRS rates; actual expenses are not deducted.
 */
export function runShortTermRental(
  input: ShortTermRentalInputs,
  params: ParameterSet,
): ScenarioResult {
  if (input.adr.length !== 12 || input.occupancy.length !== 12) {
    throw new Error("adr and occupancy need one value per calendar month");
  }
  const fixed = fixedCostsMonthly(input);
  const renovationMonths = Math.max(0, Math.round(input.renovationMonths));
  const al = params.localAccommodation;
  const coefficient =
    input.alStatus === "containment" ? al.containmentZoneCoefficient : al.coefficient;

  const operating = (m: number): OperatingMonth => {
    if (m <= renovationMonths) return { income: 0, costs: fixed };
    const calendarMonth = (input.startMonth - 1 + m - 1) % 12;
    const yearOfLetting = Math.floor((m - renovationMonths - 1) / 12);
    const nights = DAYS_IN_MONTH[calendarMonth]! * input.occupancy[calendarMonth]!;
    const stays = input.averageStayNights > 0 ? nights / input.averageStayNights : 0;
    const adr = input.adr[calendarMonth]! * (1 + input.adrGrowthRate) ** yearOfLetting;
    const bookings = nights * adr + stays * input.cleaningFeePerStay;
    const income = input.vatRegistered ? bookings / (1 + al.vatRate) : bookings;
    return {
      income,
      costs:
        fixed +
        input.utilitiesMonthly +
        bookings * input.platformFeeRate +
        income * (input.managementRate + input.maintenanceRate) +
        stays * input.cleaningCostPerStay +
        nights * input.consumablesPerNight,
    };
  };

  const sim = simulate({
    input,
    params,
    upfrontExtra: input.furnishingCost + input.registrationCost,
    operating,
    incomeTax: (block) =>
      irsOnExtraIncome(
        input.otherTaxableIncome,
        sum(block.map((o) => o.income)) * coefficient,
        params,
      ),
  });

  const result = summarise("shortTermRental", sim, input.loan?.amount ?? 0, {
    grossAnnualIncome: sim.stabilisedYear.income,
    acquisitionCost: input.purchasePrice + sim.acquisition.total,
  });

  result.annualMaintenance = sim.stabilisedYear.income * input.maintenanceRate;
  if (input.alStatus === "containment") result.warnings.push("al_containment_zone");
  if (input.alStatus === "unknown") result.warnings.push("al_status_unknown");
  if (input.alStatus === "suspended") {
    result.warnings.push("al_registrations_suspended");
    result.viable = false;
  }
  if (!input.vatRegistered && sim.stabilisedYear.income > al.vatExemptionThreshold) {
    result.warnings.push("al_vat_threshold_exceeded");
  }
  return result;
}
