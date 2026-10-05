import type { ParameterSet, PropertyUse } from "./params";

/** Rounds to cents, as tax authorities do for assessed amounts. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * IMT due on an acquisition.
 *
 * The taxable value is the higher of the price and the VPT (valor patrimonial
 * tributário). Housing uses the progressive table for its use; other urban and rustic
 * property pay a flat rate. Non-resident buyers of housing pay the flat non-resident rate
 * where the parameter set has one.
 */
export function imt(
  price: number,
  use: PropertyUse,
  params: ParameterSet,
  vpt = 0,
  nonResident = false,
): number {
  const value = Math.max(price, vpt);
  if (use === "otherUrban") return roundCents(value * params.imt.otherUrbanRate);
  if (use === "rustic") return roundCents(value * params.imt.rusticRate);
  const nonResidentRate = params.imt.nonResidentHousingRate;
  if (nonResident && nonResidentRate !== undefined) return roundCents(value * nonResidentRate);

  const bracket = params.imt[use].find((b) => b.upTo === null || value <= b.upTo);
  if (!bracket) throw new Error(`IMT table for "${use}" has no open-ended bracket`);
  return roundCents(Math.max(0, value * bracket.rate - bracket.deduction));
}

export interface AcquisitionInput {
  price: number;
  use: PropertyUse;
  vpt?: number;
  loanAmount: number;
  /** Overrides the typical deed and registry fees from the parameters. */
  deedAndRegistry?: number;
  /** Bank's property valuation fee, paid when there is a loan. */
  valuationFee?: number;
  /** Bank's process opening (dossier) fee, paid when there is a loan. */
  processingFee?: number;
  /** Anything else the buyer pays: lawyer, inspection, intermediary. */
  otherCosts?: number;
  /** The buyer is not resident in Portugal (affects IMT on housing from 2026). */
  nonResident?: boolean;
}

export interface AcquisitionCosts {
  imt: number;
  stampDutyPurchase: number;
  stampDutyLoan: number;
  deedAndRegistry: number;
  valuationFee: number;
  processingFee: number;
  otherCosts: number;
  total: number;
  /** Costs that count towards the acquisition value for capital gains (IMT, stamp duty, deed). */
  deductibleForCapitalGains: number;
}

/** All one-off costs of buying, on top of the price. */
export function acquisitionCosts(input: AcquisitionInput, params: ParameterSet): AcquisitionCosts {
  const hasLoan = input.loanAmount > 0;
  const taxableValue = Math.max(input.price, input.vpt ?? 0);

  const imtDue = imt(input.price, input.use, params, input.vpt, input.nonResident);
  const stampDutyPurchase = roundCents(taxableValue * params.stampDuty.purchaseRate);
  const stampDutyLoan = roundCents(input.loanAmount * params.stampDuty.loanRate);
  const deedAndRegistry =
    input.deedAndRegistry ??
    (hasLoan
      ? params.transactionFees.deedAndRegistryWithMortgage
      : params.transactionFees.deedAndRegistry);
  const valuationFee = hasLoan ? (input.valuationFee ?? 0) : 0;
  const processingFee = hasLoan ? (input.processingFee ?? 0) : 0;
  const otherCosts = input.otherCosts ?? 0;

  return {
    imt: imtDue,
    stampDutyPurchase,
    stampDutyLoan,
    deedAndRegistry,
    valuationFee,
    processingFee,
    otherCosts,
    total:
      imtDue +
      stampDutyPurchase +
      stampDutyLoan +
      deedAndRegistry +
      valuationFee +
      processingFee +
      otherCosts,
    deductibleForCapitalGains: imtDue + stampDutyPurchase + deedAndRegistry,
  };
}
