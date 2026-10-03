import { acquisitionCosts, type AcquisitionCosts } from "./acquisition";
import { amortize, type Loan, type LoanMonth } from "./financing";
import { annualise, irr } from "./metrics";
import type { ParameterSet, PropertyUse } from "./params";

/**
 * Inputs shared by the scenarios that buy a property (flip, long-term and short-term rental).
 *
 * Timeline: month 0 is the purchase; months 1…holdingMonths follow; the property is sold
 * at the end of month `holdingMonths`.
 */
export interface PropertyInputs {
  purchasePrice: number;
  propertyUse: PropertyUse;
  /** Valor patrimonial tributário; when unknown the purchase price is used (conservative). */
  vpt?: number;
  /** Municipal IMI rate, e.g. 0.003. */
  imiRate: number;
  /** Overrides for typical transaction fees, plus any other buying costs. */
  deedAndRegistry?: number;
  bankFees?: number;
  otherAcquisitionCosts?: number;

  renovationBudget: number;
  /** Months of works; the budget is spread evenly over them and no income is earned. */
  renovationMonths: number;

  loan: Loan | null;
  /** Early repayment fee rate; defaults to the parameter set. */
  earlyRepaymentFeeRate?: number;

  holdingMonths: number;
  /** Expected sale price at the end of the holding period. */
  exitPrice: number;
  /** Agency commission on the sale, excluding VAT. */
  sellingCommissionRate: number;

  /** The investor's marginal IRS rate, used for capital gains and category B income. */
  marginalTaxRate: number;
  /** The buyer is not resident in Portugal (non-resident IMT rate where it applies). */
  buyerNonResident?: boolean;

  condominiumMonthly: number;
  insuranceAnnual: number;
}

/** Operating income and costs of one month, as provided by a scenario. */
export interface OperatingMonth {
  income: number;
  costs: number;
}

export interface MonthLine {
  month: number;
  income: number;
  operatingCosts: number;
  renovation: number;
  debtService: number;
  incomeTax: number;
  /** Sale price minus selling costs (month of sale only). */
  saleProceeds: number;
  /** Loan balance plus early repayment fee (month of sale only). */
  loanPayoff: number;
  capitalGainsTax: number;
  cashFlow: number;
  cumulative: number;
}

/** Codes, translated by the UI. */
export type Warning =
  | "vpt_estimated"
  | "ltv_above_limit"
  | "holding_shorter_than_renovation"
  | "negative_cash_flow"
  | "al_containment_zone"
  | "al_registrations_suspended"
  | "al_status_unknown"
  | "al_vat_threshold_exceeded"
  | "assignment_above_market"
  | "assignment_upfront_imt"
  | "imt_non_resident";

export type ScenarioKind = "flip" | "longTermRental" | "shortTermRental" | "contractAssignment";

export interface ScenarioResult {
  kind: ScenarioKind;
  /** False when the scenario is not realistically available (e.g. AL registrations suspended). */
  viable: boolean;
  warnings: Warning[];

  acquisition: AcquisitionCosts | null;
  /** Price + acquisition costs + renovation + other upfront spending. */
  totalInvestment: number;
  loanAmount: number;
  /** Total investment − loan: the equity the investor puts in upfront. */
  ownCapital: number;
  /** Largest cumulative cash outlay at any point, including holding costs. */
  peakCapital: number;

  /** Sum of all cash flows, after financing and taxes, including the exit. */
  netProfit: number;
  /** Net profit ÷ own capital. */
  roi: number | null;
  /** Annualised IRR of the monthly cash flows. */
  irr: number | null;

  /** Rental scenarios only; first full year after renovation. */
  grossYield: number | null;
  netYield: number | null;
  /** Average monthly cash flow after financing and taxes, first full year. */
  monthlyCashFlow: number | null;
  /** Own capital ÷ annual cash flow, in years; null when cash flow is not positive. */
  paybackYears: number | null;
  /** Contract assignment only: net profit ÷ deposit (sinal). */
  returnOnDeposit: number | null;

  months: MonthLine[];
}

/** Annual IMI, condominium and insurance spread per month. */
export function fixedCostsMonthly(input: PropertyInputs): number {
  const vpt = input.vpt ?? input.purchasePrice;
  return (vpt * input.imiRate) / 12 + input.condominiumMonthly + input.insuranceAnnual / 12;
}

export interface SimulationSpec {
  input: PropertyInputs;
  params: ParameterSet;
  /** Upfront spending on top of price, acquisition costs and renovation (e.g. furnishing). */
  upfrontExtra?: number;
  /** Operating figures for month m (1-based). Must be pure: it is also called past the exit. */
  operating(month: number): OperatingMonth;
  /** Income tax for a block of up to 12 consecutive operating months. */
  incomeTax(block: OperatingMonth[]): number;
}

export interface Simulation {
  acquisition: AcquisitionCosts;
  totalInvestment: number;
  ownCapital: number;
  warnings: Warning[];
  months: MonthLine[];
  /** First full year after renovation, unlevered and levered. */
  stabilisedYear: {
    income: number;
    operatingCosts: number;
    incomeTax: number;
    debtService: number;
  };
}

/**
 * Runs a monthly cash-flow simulation for a property scenario.
 *
 * Simplifications (documented in METHODOLOGY.md): income tax is paid once per 12-month
 * block, at the end of the block; capital gains tax is paid in the month of sale; IMI is
 * accrued monthly.
 */
export function simulate(spec: SimulationSpec): Simulation {
  const { input, params } = spec;
  const warnings: Warning[] = [];
  const loan = input.loan && input.loan.amount > 0 ? input.loan : null;
  const loanAmount = loan?.amount ?? 0;
  const holding = Math.max(1, Math.round(input.holdingMonths));
  const renovationMonths = Math.max(0, Math.round(input.renovationMonths));

  if (input.vpt === undefined) warnings.push("vpt_estimated");
  if (holding < renovationMonths) warnings.push("holding_shorter_than_renovation");
  const maxLtv =
    input.propertyUse === "hpp" ? params.financing.maxLtv.hpp : params.financing.maxLtv.other;
  if (loanAmount > input.purchasePrice * maxLtv) warnings.push("ltv_above_limit");

  const acquisition = acquisitionCosts(
    {
      price: input.purchasePrice,
      use: input.propertyUse,
      vpt: input.vpt,
      loanAmount,
      deedAndRegistry: input.deedAndRegistry,
      bankFees: input.bankFees,
      otherCosts: input.otherAcquisitionCosts,
      nonResident: input.buyerNonResident,
    },
    params,
  );
  if (
    input.buyerNonResident &&
    params.imt.nonResidentHousingRate !== undefined &&
    (input.propertyUse === "hpp" || input.propertyUse === "secondary")
  ) {
    warnings.push("imt_non_resident");
  }
  const upfrontExtra = spec.upfrontExtra ?? 0;
  const totalInvestment =
    input.purchasePrice + acquisition.total + input.renovationBudget + upfrontExtra;

  const stabilisedEnd = renovationMonths + 12;
  const schedule: LoanMonth[] = loan
    ? amortize(loan, Math.max(holding, stabilisedEnd), params.stampDuty.interestRate)
    : [];
  const debtService = (m: number) => {
    const l = schedule[m - 1];
    return l ? l.payment + l.stampDuty : 0;
  };

  const renovationMonthly = renovationMonths > 0 ? input.renovationBudget / renovationMonths : 0;
  const renovationAtStart = renovationMonths > 0 ? 0 : input.renovationBudget;

  const months: MonthLine[] = [];
  const start = -(
    input.purchasePrice +
    acquisition.total +
    upfrontExtra +
    renovationAtStart -
    loanAmount
  );
  months.push(emptyLine(0, start, start));

  let block: OperatingMonth[] = [];
  let cumulative = start;
  for (let m = 1; m <= holding; m++) {
    const op = spec.operating(m);
    block.push(op);
    const isSale = m === holding;
    const incomeTax = block.length === 12 || isSale ? spec.incomeTax(block) : 0;
    if (block.length === 12) block = [];

    const line = emptyLine(m, 0, 0);
    line.income = op.income;
    line.operatingCosts = op.costs;
    line.renovation = m <= renovationMonths ? renovationMonthly : 0;
    line.debtService = debtService(m);
    line.incomeTax = incomeTax;

    if (isSale) {
      const sellingCosts = input.exitPrice * input.sellingCommissionRate * (1 + params.vatRate);
      line.saleProceeds = input.exitPrice - sellingCosts;
      const balance = schedule[m - 1]?.balance ?? 0;
      const feeRate = input.earlyRepaymentFeeRate ?? params.financing.earlyRepaymentFeeRate;
      line.loanPayoff = balance * (1 + feeRate);

      const gain =
        line.saleProceeds -
        input.purchasePrice -
        acquisition.deductibleForCapitalGains -
        input.renovationBudget;
      line.capitalGainsTax =
        Math.max(0, gain) * params.capitalGains.inclusionRate * input.marginalTaxRate;
    }

    line.cashFlow =
      line.income -
      line.operatingCosts -
      line.renovation -
      line.debtService -
      line.incomeTax +
      line.saleProceeds -
      line.loanPayoff -
      line.capitalGainsTax;
    cumulative += line.cashFlow;
    line.cumulative = cumulative;
    months.push(line);
  }

  const stabilised: OperatingMonth[] = [];
  let stabilisedDebt = 0;
  for (let m = renovationMonths + 1; m <= stabilisedEnd; m++) {
    stabilised.push(spec.operating(m));
    stabilisedDebt += debtService(m);
  }

  return {
    acquisition,
    totalInvestment,
    ownCapital: totalInvestment - loanAmount,
    warnings,
    months,
    stabilisedYear: {
      income: sum(stabilised.map((o) => o.income)),
      operatingCosts: sum(stabilised.map((o) => o.costs)),
      incomeTax: spec.incomeTax(stabilised),
      debtService: stabilisedDebt,
    },
  };
}

/** Builds the common result fields from a simulation. */
export function summarise(
  kind: ScenarioKind,
  sim: Simulation,
  loanAmount: number,
  rental: { grossAnnualIncome: number; acquisitionCost: number } | null,
): ScenarioResult {
  const cashFlows = sim.months.map((l) => l.cashFlow);
  const netProfit = sum(cashFlows);
  const peakCapital = Math.max(0, -Math.min(...sim.months.map((l) => l.cumulative)));
  const monthlyIrr = irr(cashFlows);

  let grossYield = null;
  let netYield = null;
  let monthlyCashFlow = null;
  let paybackYears = null;
  const warnings = [...sim.warnings];

  if (rental) {
    const y = sim.stabilisedYear;
    grossYield = rental.grossAnnualIncome / rental.acquisitionCost;
    netYield = (y.income - y.operatingCosts - y.incomeTax) / sim.totalInvestment;
    const annualCashFlow = y.income - y.operatingCosts - y.incomeTax - y.debtService;
    monthlyCashFlow = annualCashFlow / 12;
    paybackYears = annualCashFlow > 0 ? sim.ownCapital / annualCashFlow : null;
    if (annualCashFlow < 0) warnings.push("negative_cash_flow");
  }

  return {
    kind,
    viable: true,
    warnings,
    acquisition: sim.acquisition,
    totalInvestment: sim.totalInvestment,
    loanAmount,
    ownCapital: sim.ownCapital,
    peakCapital,
    netProfit,
    roi: sim.ownCapital > 0 ? netProfit / sim.ownCapital : null,
    irr: monthlyIrr === null ? null : annualise(monthlyIrr),
    grossYield,
    netYield,
    monthlyCashFlow,
    paybackYears,
    returnOnDeposit: null,
    months: sim.months,
  };
}

export function emptyLine(month: number, cashFlow: number, cumulative: number): MonthLine {
  return {
    month,
    income: 0,
    operatingCosts: 0,
    renovation: 0,
    debtService: 0,
    incomeTax: 0,
    saleProceeds: 0,
    loanPayoff: 0,
    capitalGainsTax: 0,
    cashFlow,
    cumulative,
  };
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
