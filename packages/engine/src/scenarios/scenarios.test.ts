import { describe, expect, it } from "vitest";
import { params2025 as params } from "../__fixtures__/params2025";
import type { PropertyInputs } from "../simulation";
import { runContractAssignment, suggestAssignmentPrice } from "./contractAssignment";
import { runFlip } from "./flip";
import {
  rentalIncomeTaxRate,
  runLongTermRental,
  type LongTermRentalInputs,
} from "./longTermRental";
import { runShortTermRental, type ShortTermRentalInputs } from "./shortTermRental";

/**
 * Worked example shared by the property scenarios (developer-prepared, not yet checked
 * against the accountant's reference spreadsheet):
 *
 * 200 000 € apartment bought as investment (secondary), VPT 100 000 €, IMI 0.3 %, no loan.
 *   IMT = 200 000 × 7 % − 9 210.31 = 4 789.69
 *   Stamp duty = 200 000 × 0.8 % = 1 600
 *   Deed and registry = 375
 *   Acquisition costs = 6 764.69 → price + costs = 206 764.69
 * IMI = 100 000 × 0.3 % ÷ 12 = 25 €/month.
 */
const base: PropertyInputs = {
  purchasePrice: 200_000,
  propertyUse: "secondary",
  vpt: 100_000,
  imiRate: 0.003,
  renovationBudget: 0,
  renovationMonths: 0,
  loan: null,
  holdingMonths: 24,
  exitPrice: 200_000,
  sellingCommissionRate: 0,
  // 30 000 € of other income: the 6th 2025 bracket (34.9 %) runs up to 41 629 €.
  otherTaxableIncome: 30_000,
  condominiumMonthly: 0,
  insuranceAnnual: 0,
};
const BOUGHT = 206_764.69;

describe("runFlip", () => {
  const flip = runFlip(
    {
      ...base,
      renovationBudget: 30_000,
      renovationMonths: 3,
      holdingMonths: 6,
      exitPrice: 300_000,
      sellingCommissionRate: 0.05,
      utilitiesMonthly: 50,
    },
    params,
  );

  it("computes profit after holding costs and capital gains tax", () => {
    // Holding costs: 25 IMI + 50 utilities = 75/month. Renovation 10 000/month for 3 months.
    // Sale: 300 000 − 5 % × 1.23 commission = 281 550.
    // Gain: 281 550 − 200 000 − 6 764.69 − 30 000 = 44 785.31; 50 % = 22 392.655 added to
    // 30 000: 11 629 at 34.9 % (to 41 629), 3 358 at 43.1 % (to 44 987), rest at 44.6 %.
    const tax = 11_629 * 0.349 + 3_358 * 0.431 + (22_392.655 - 11_629 - 3_358) * 0.446;
    expect(flip.months.at(-1)!.capitalGainsTax).toBeCloseTo(tax, 2);
    expect(flip.netProfit).toBeCloseTo(-BOUGHT - 30_000 - 6 * 75 + 281_550 - tax, 2);
  });

  it("shows how the capital gains tax is reached", () => {
    const g = flip.gainTax!;
    expect(g.lines.map((l) => l.key)).toEqual([
      "salePrice",
      "sellingCommission",
      "purchasePrice",
      "acquisitionCosts",
      "renovation",
    ]);
    expect(g.gain).toBeCloseTo(44_785.31, 2);
    expect(g.taxable).toBeCloseTo(22_392.655, 3);
    expect(g.slices.map((s) => s.bracket)).toEqual([6, 7, 8]);
    expect(g.tax).toBe(flip.months.at(-1)!.capitalGainsTax);
  });

  it("reports investment, capital and returns", () => {
    expect(flip.totalInvestment).toBeCloseTo(BOUGHT + 30_000, 2);
    expect(flip.ownCapital).toBeCloseTo(BOUGHT + 30_000, 2);
    expect(flip.peakCapital).toBeCloseTo(BOUGHT + 30_000 + 5 * 75, 2);
    expect(flip.roi).toBeCloseTo(flip.netProfit! / flip.ownCapital, 10);
    expect(flip.irr).toBeGreaterThan(0.2);
    expect(flip.grossYield).toBeNull();
    expect(flip.months).toHaveLength(7);
  });
});

describe("runLongTermRental", () => {
  // Rent 1 000, 5 % maintenance; condominium 50, insurance 240/yr (20/month).
  // Costs per month: 25 IMI + 50 + 20 + 50 maintenance = 145. Taxable per year 12 × 855 = 10 260.
  const input: LongTermRentalInputs = {
    ...base,
    condominiumMonthly: 50,
    insuranceAnnual: 240,
    monthlyRent: 1_000,
    rentGrowthRate: 0,
    contractMonths: 24,
    vacancyMonths: 0,
    maintenanceRate: 0.05,
    managementRate: 0,
    rentalTax: { mode: "autonomous", contractYears: 2 },
  };
  const rental = runLongTermRental(input, params);

  it("computes yields on the first full year", () => {
    const tax = 10_260 * 0.25;
    expect(rental.grossYield).toBeCloseTo(12_000 / BOUGHT, 10);
    expect(rental.netYield).toBeCloseTo((12_000 - 12 * 145 - tax) / BOUGHT, 10);
    expect(rental.monthlyCashFlow).toBeCloseTo((10_260 - tax) / 12, 6);
    expect(rental.paybackYears).toBeCloseTo(BOUGHT / (10_260 - tax), 6);
  });

  it("shows the yearly maintenance", () => {
    expect(rental.annualMaintenance).toBeCloseTo(12 * 50, 6);
  });

  it("pays income tax once a year and sells at the end", () => {
    expect(rental.months[12]!.incomeTax).toBeCloseTo(2_565, 6);
    expect(rental.months[11]!.incomeTax).toBe(0);
    // Sold at the purchase price: a loss, so no capital gains tax.
    expect(rental.months[24]!.capitalGainsTax).toBe(0);
    expect(rental.gainTax!.gain).toBeLessThan(0);
    expect(rental.netProfit).toBeCloseTo(-BOUGHT + 24 * 855 - 2 * 2_565 + 200_000, 2);
  });

  it("leaves the property empty between leases", () => {
    // 12-month leases with 2 empty months: letting months 13 and 14 have no rent.
    const cycles = runLongTermRental({ ...input, contractMonths: 12, vacancyMonths: 2 }, params);
    expect(cycles.months[12]!.income).toBe(1_000);
    expect(cycles.months[13]!.income).toBe(0);
    expect(cycles.months[14]!.income).toBe(0);
    expect(cycles.months[15]!.income).toBe(1_000);
    // The typical year spreads the vacancy: 12 / 14 of the rent, net of the 5 % maintenance.
    const yearlyRent = (1_000 * 12 * 12) / 14;
    const costs = 12 * 95 + yearlyRent * 0.05;
    const tax = (yearlyRent - costs) * 0.25;
    expect(cycles.netYield).toBeCloseTo((yearlyRent - costs - tax) / BOUGHT, 10);
  });

  it("can keep the property: no sale at the end", () => {
    const kept = runLongTermRental({ ...input, holdingMonths: 18, exitPrice: null }, params);
    const last = kept.months.at(-1)!;
    expect(last.saleProceeds).toBe(0);
    expect(last.capitalGainsTax).toBe(0);
    // The last, partial year is still taxed: 6 months × 855 at 25 %.
    expect(last.incomeTax).toBeCloseTo(6 * 855 * 0.25, 6);
    // Without a sale there is no profit or IRR; the rent's yield over the period is reported.
    expect(kept.netProfit).toBeNull();
    expect(kept.gainTax).toBeNull();
    expect(kept.irr).toBeNull();
    expect(kept.lifetimeCashFlow).toBeCloseTo(18 * 855 - 2_565 - 6 * 855 * 0.25, 2);
    expect(kept.annualCashFlow).toBeCloseTo(12 * 855 * 0.75, 6);
    expect(kept.cashOnCash).toBeCloseTo((12 * 855 * 0.75) / BOUGHT, 10);
  });

  it("charges only the early repayment fee and loan costs for a 0 % loan", () => {
    const financed = runLongTermRental(
      {
        ...input,
        loan: { amount: 100_000, annualRate: 0, termYears: 10 },
        valuationFee: 250,
        processingFee: 300,
      },
      params,
    );
    // Loan stamp duty 600, deed with mortgage +325, valuation 250, process opening 300,
    // early repayment fee 0.5 % × 80 000 outstanding = 400.
    expect(financed.netProfit).toBeCloseTo(rental.netProfit! - 600 - 325 - 550 - 400, 2);
    expect(financed.ownCapital).toBeCloseTo(BOUGHT + 600 + 325 + 550 - 100_000, 2);
    expect(financed.monthlyCashFlow).toBeCloseTo(rental.monthlyCashFlow! - 833.33, 2);
  });

  it("charges the signing costs with a TAEG, but no stamp duty on each interest payment", () => {
    const loan = { amount: 100_000, annualRate: 0.04, termYears: 10 };
    const fees = { valuationFee: 250, processingFee: 300 };
    const tan = runLongTermRental({ ...input, ...fees, loan }, params);
    const taeg = runLongTermRental(
      { ...input, ...fees, loan: { ...loan, rateType: "taeg" } },
      params,
    );
    // Stamp duty on the loan (600), mortgage registration (+325) and fees: charged at signing.
    expect(taeg.acquisition).toEqual(tan.acquisition);
    expect(taeg.acquisition!.stampDutyLoan).toBe(600);
    // The TAEG is the global rate: no 4 % stamp duty on top of the interest.
    expect(taeg.months[1]!.debtService).toBeLessThan(tan.months[1]!.debtService);
  });

  it("reports the yearly IMI, condominium and insurance", () => {
    // VPT 100 000 × 0.3 % = 300; condominium 50 × 12; insurance 240.
    expect(rental.annualFixedCosts).toEqual({ imi: 300, condominium: 600, insurance: 240 });
  });

  it("delays rent until renovation ends and grows it yearly", () => {
    const renovated = runLongTermRental(
      { ...input, renovationBudget: 12_000, renovationMonths: 2, rentGrowthRate: 0.02 },
      params,
    );
    expect(renovated.months[2]!.income).toBe(0);
    expect(renovated.months[3]!.income).toBe(1_000);
    expect(renovated.months[15]!.income).toBeCloseTo(1_020, 10);
  });

  it("warns when cash flow is negative", () => {
    const expensive = runLongTermRental(
      { ...input, loan: { amount: 160_000, annualRate: 0.05, termYears: 20 } },
      params,
    );
    expect(expensive.warnings).toContain("negative_cash_flow");
  });

  it("flags loans above the LTV limit", () => {
    const highLtv = runLongTermRental(
      { ...input, loan: { amount: 180_000, annualRate: 0.03, termYears: 30 } },
      params,
    );
    expect(highLtv.warnings).toContain("ltv_above_limit");
  });
});

describe("rentalIncomeTaxRate", () => {
  it("reduces the autonomous rate for long contracts", () => {
    const rate = (contractYears: number) => rentalIncomeTaxRate(contractYears, params);
    expect(rate(1)).toBe(0.25);
    expect(rate(5)).toBe(0.15);
    expect(rate(12)).toBe(0.1);
    expect(rate(25)).toBe(0.05);
  });
});

describe("runShortTermRental", () => {
  // ADR 100, 50 % occupancy all year: 182.5 nights, 60.83 stays of 3 nights.
  // Bookings: 18 250 + 60.83 × 30 cleaning fee = 20 075.
  // Costs: 12 × (25 IMI + 50 condo + 20 insurance) + 12 × 100 utilities
  //        + 15 % platform (3 011.25) + 60.83 × 30 cleaning (1 825) = 7 176.25.
  // Tax: 20 075 × 35 % coefficient = 7 026.25 added to 30 000, all at 34.9 % = 2 452.16.
  const input: ShortTermRentalInputs = {
    ...base,
    condominiumMonthly: 50,
    insuranceAnnual: 240,
    adr: Array(12).fill(100),
    occupancy: Array(12).fill(0.5),
    adrGrowthRate: 0,
    startMonth: 1,
    averageStayNights: 3,
    cleaningFeePerStay: 30,
    cleaningCostPerStay: 30,
    platformFeeRate: 0.15,
    managementRate: 0,
    maintenanceRate: 0,
    utilitiesMonthly: 100,
    consumablesPerNight: 0,
    furnishingCost: 10_000,
    registrationCost: 0,
    alStatus: "allowed",
    vatRegistered: false,
  };
  const al = runShortTermRental(input, params);

  it("computes yearly income, costs and tax", () => {
    const tax = 20_075 * 0.35 * 0.349;
    expect(al.grossYield).toBeCloseTo(20_075 / BOUGHT, 8);
    expect(al.netYield).toBeCloseTo((20_075 - 7_176.25 - tax) / (BOUGHT + 10_000), 8);
    expect(al.totalInvestment).toBeCloseTo(BOUGHT + 10_000, 2);
    expect(al.months[12]!.incomeTax).toBeCloseTo(tax, 6);
  });

  it("counts maintenance as a share of the income", () => {
    const kept = runShortTermRental({ ...input, maintenanceRate: 0.2 }, params);
    expect(kept.annualMaintenance).toBeCloseTo(20_075 * 0.2, 6);
    expect(al.annualMaintenance).toBe(0);
    // Deducted from the yearly cash flow; the AL tax is on income, so it does not change.
    expect(al.annualCashFlow! - kept.annualCashFlow!).toBeCloseTo(20_075 * 0.2, 6);
  });

  it("follows seasonality", () => {
    const seasonal = runShortTermRental(
      { ...input, occupancy: [0.2, 0.2, 0.3, 0.5, 0.6, 0.8, 0.9, 0.9, 0.7, 0.5, 0.3, 0.2] },
      params,
    );
    expect(seasonal.months[1]!.income).toBeLessThan(seasonal.months[8]!.income);
  });

  it("warns above the VAT exemption threshold and removes VAT when registered", () => {
    expect(al.warnings).toContain("al_vat_threshold_exceeded");
    const withVat = runShortTermRental({ ...input, vatRegistered: true }, params);
    expect(withVat.warnings).not.toContain("al_vat_threshold_exceeded");
    expect(withVat.months[1]!.income).toBeCloseTo(al.months[1]!.income / 1.06, 8);
  });

  it("taxes more in containment zones and blocks suspended areas", () => {
    const contained = runShortTermRental({ ...input, alStatus: "containment" }, params);
    expect(contained.months[12]!.incomeTax).toBeCloseTo(20_075 * 0.5 * 0.349, 6);
    expect(contained.warnings).toContain("al_containment_zone");
    expect(contained.viable).toBe(true);

    const suspended = runShortTermRental({ ...input, alStatus: "suspended" }, params);
    expect(suspended.viable).toBe(false);
    expect(suspended.warnings).toContain("al_registrations_suspended");
  });

  it("rejects incomplete seasonality", () => {
    expect(() => runShortTermRental({ ...input, adr: [100] }, params)).toThrow();
  });
});

describe("runContractAssignment", () => {
  // CPCV 300 000, deposit 30 000, market value 340 000 after 6 months.
  // Suggested assignment price: 30 000 + 50 % × 40 000 = 50 000 (premium 20 000).
  // Commission 5 % × 20 000 × 1.23 = 1 230; lawyer 500.
  // Gain 18 270 → 9 135 added to 30 000 of other income, at 34.9 % = 3 188.115.
  // Net profit 15 081.885.
  const input = {
    cpcvPrice: 300_000,
    deposit: 30_000,
    assignmentMonth: 6,
    assignmentPrice: 0,
    marketValueAtAssignment: 340_000,
    commissionRate: 0.05,
    otherCosts: 500,
    upfrontTransferTaxes: false,
    propertyUse: "secondary" as const,
    otherTaxableIncome: 30_000,
  };
  input.assignmentPrice = suggestAssignmentPrice(input);
  const result = runContractAssignment(input, params);

  it("suggests a price from the expected uplift", () => {
    expect(input.assignmentPrice).toBe(50_000);
  });

  it("computes profit and return on the deposit", () => {
    expect(result.netProfit).toBeCloseTo(15_081.885, 2);
    expect(result.returnOnDeposit).toBeCloseTo(15_081.885 / 30_000, 10);
    expect(result.irr).toBeCloseTo((45_081.885 / 30_000) ** 2 - 1, 8);
    expect(result.warnings).toEqual([]);
  });

  it("includes upfront IMT and stamp duty when the CPCV allows assignment", () => {
    // IMT 300 000 × 7 % − 9 210.31 = 11 789.69; stamp duty 2 400.
    const upfront = runContractAssignment({ ...input, upfrontTransferTaxes: true }, params);
    const gain = 18_270 - 14_189.69;
    expect(upfront.ownCapital).toBeCloseTo(44_189.69, 2);
    expect(upfront.netProfit).toBeCloseTo(gain - gain * 0.5 * 0.349, 2);
    expect(upfront.warnings).toContain("assignment_upfront_imt");
  });

  it("warns when the new buyer would pay more than market value", () => {
    const high = runContractAssignment({ ...input, assignmentPrice: 80_000 }, params);
    expect(high.warnings).toContain("assignment_above_market");
  });
});
