import { gainTax } from "../tax";
import { imt, roundCents } from "../acquisition";
import { annualise, irr } from "../metrics";
import type { ParameterSet, PropertyUse } from "../params";
import { emptyLine, type ScenarioResult, type Warning } from "../simulation";

/**
 * Cessão de posição contratual: the investor signs a CPCV, pays the deposit (sinal) and,
 * before the deed, assigns their position to a third party for a price.
 */
export interface ContractAssignmentInputs {
  /** Price agreed in the CPCV. */
  cpcvPrice: number;
  /** Deposit (sinal) paid at signing, month 0. */
  deposit: number;
  /** Month in which the position is assigned. */
  assignmentMonth: number;
  /**
   * Total amount the new buyer pays the investor for the position, including the
   * reimbursement of the deposit.
   */
  assignmentPrice: number;
  /** Expected market value of the property at the time of the assignment. */
  marketValueAtAssignment: number;
  /** Agency commission on the premium (assignment price − deposit), excluding VAT. */
  commissionRate: number;
  /** Lawyer and other costs of the assignment. */
  otherCosts: number;
  /**
   * When the CPCV allows assignment to a third party, IMT and stamp duty may be due on
   * signing. Set to true to include them as an upfront cost.
   */
  upfrontTransferTaxes: boolean;
  propertyUse: PropertyUse;
  vpt?: number;
  /** The investor's other annual taxable income (0 when unknown); the gain is added to it. */
  otherTaxableIncome: number;
  buyerNonResident?: boolean;
}

/** A starting point for the assignment price: deposit plus a share of the expected uplift. */
export function suggestAssignmentPrice(
  input: Pick<ContractAssignmentInputs, "cpcvPrice" | "deposit" | "marketValueAtAssignment">,
  upliftShare = 0.5,
): number {
  return input.deposit + Math.max(0, input.marketValueAtAssignment - input.cpcvPrice) * upliftShare;
}

/**
 * Contract position selling. Cash flows: deposit (and upfront transfer taxes) at month 0;
 * assignment price minus costs and capital gains tax at the assignment month.
 */
export function runContractAssignment(
  input: ContractAssignmentInputs,
  params: ParameterSet,
): ScenarioResult {
  const warnings: Warning[] = [];
  const month = Math.max(1, Math.round(input.assignmentMonth));

  let upfrontTaxes = 0;
  if (input.upfrontTransferTaxes) {
    warnings.push("assignment_upfront_imt");
    upfrontTaxes =
      imt(input.cpcvPrice, input.propertyUse, params, input.vpt, input.buyerNonResident) +
      roundCents(Math.max(input.cpcvPrice, input.vpt ?? 0) * params.stampDuty.purchaseRate);
  }

  const buyerTotal = input.cpcvPrice - input.deposit + input.assignmentPrice;
  if (buyerTotal > input.marketValueAtAssignment) warnings.push("assignment_above_market");

  const premium = input.assignmentPrice - input.deposit;
  const commission = Math.max(0, premium) * input.commissionRate * (1 + params.vatRate);
  const assignmentTax = gainTax(
    [
      { key: "assignmentPrice", amount: input.assignmentPrice },
      { key: "deposit", amount: -input.deposit },
      { key: "sellingCommission", amount: -commission, rate: input.commissionRate },
      { key: "otherCosts", amount: -input.otherCosts },
      { key: "upfrontTaxes", amount: -upfrontTaxes },
    ],
    params.contractAssignment.inclusionRate,
    input.otherTaxableIncome,
    params,
  );
  const tax = assignmentTax.tax;

  const ownCapital = input.deposit + upfrontTaxes;
  const months = [emptyLine(0, -ownCapital, -ownCapital)];
  for (let m = 1; m <= month; m++) {
    months.push(emptyLine(m, 0, -ownCapital));
  }
  const last = months[month]!;
  last.saleProceeds = input.assignmentPrice - commission - input.otherCosts;
  last.capitalGainsTax = tax;
  last.cashFlow = last.saleProceeds - tax;
  last.cumulative = -ownCapital + last.cashFlow;

  const netProfit = last.cumulative;
  const monthlyIrr = irr(months.map((l) => l.cashFlow));

  return {
    kind: "contractAssignment",
    viable: true,
    warnings,
    acquisition: null,
    totalInvestment: ownCapital,
    loanAmount: 0,
    ownCapital,
    peakCapital: ownCapital,
    netProfit,
    roi: ownCapital > 0 ? netProfit / ownCapital : null,
    irr: monthlyIrr === null ? null : annualise(monthlyIrr),
    grossYield: null,
    netYield: null,
    monthlyCashFlow: null,
    annualCashFlow: null,
    cashOnCash: null,
    lifetimeCashFlow: null,
    paybackYears: null,
    returnOnDeposit: input.deposit > 0 ? netProfit / input.deposit : null,
    annualFixedCosts: null,
    annualMaintenance: null,
    gainTax: assignmentTax,
    months,
  };
}
