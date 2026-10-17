import {
  irsOnExtraIncome,
  irsSlicesOnExtraIncome,
  type IrsSlice,
  type ParameterSet,
} from "@observatorio-habitacao/engine";
import { monetaryCoefficient, UNTAXED_BEFORE } from "./coefficients";
import type { ValuationState } from "./state";

/** An amount in the gain: positive when received, negative when deducted. */
export type SellerGainLineKey =
  | "salePrice"
  | "sellingCommission"
  | "otherCosts"
  | "purchasePrice"
  | "monetaryCorrection"
  | "purchaseCosts"
  | "works";

export interface SellerGainTax {
  lines: { key: SellerGainLineKey; amount: number }[];
  /** Coefficient applied to the purchase price (1 when not applied). */
  coefficient: number;
  gain: number;
  /** Bought before 1989: the gain is not taxed. */
  untaxed: boolean;
  /** Share of the gain excluded by reinvesting in a new own permanent home (0–1). */
  reinvestedShare: number;
  inclusionRate: number;
  /** The share of the gain added to the taxable income. */
  taxable: number;
  otherTaxableIncome: number;
  slices: IrsSlice[];
  tax: number;
}

export interface Proceeds {
  salePrice: number;
  commissionRate: number;
  vatRate: number;
  /** Commission with VAT. */
  commission: number;
  otherCosts: number;
  /** Null until the purchase price is entered. */
  gainTax: SellerGainTax | null;
  loanBalance: number;
  earlyRepaymentFee: number;
  /** What the seller keeps. */
  net: number;
}

/**
 * What the seller keeps from a sale: the price, less the agency commission (with VAT), other
 * costs, the IRS on the gain (mais-valia, CIRS art. 10 and 43) and the loan repaid with its
 * early repayment fee.
 *
 * The gain is the price less the commission and other costs, the purchase price corrected for
 * inflation (held over 24 months), what was paid on buying and works of the last 12 years. For
 * an own permanent home, the share of the sale reinvested in a new one (the price less the loan
 * repaid, art. 10 n.º 5 and 7) is excluded. Half of what remains is added to the year's income.
 */
export function sellerProceeds(
  state: ValuationState,
  salePrice: number,
  params: ParameterSet,
  saleYear: number,
): Proceeds {
  const commission = salePrice * state.sellingCommissionRate * (1 + params.vatRate);
  const otherCosts = state.otherSaleCosts ?? 0;
  const loanBalance = Math.min(state.loanBalance ?? 0, salePrice);
  const earlyRepaymentFee = loanBalance * state.earlyRepaymentRate;

  let gainTax: SellerGainTax | null = null;
  if (state.purchasePrice !== null) {
    const year = state.purchaseYear;
    const untaxed = year !== null && year < UNTAXED_BEFORE;
    const coefficient = year !== null && !untaxed ? monetaryCoefficient(year, saleYear) : 1;
    const lines: SellerGainTax["lines"] = [
      { key: "salePrice", amount: salePrice },
      { key: "sellingCommission", amount: -commission },
      { key: "otherCosts", amount: -otherCosts },
      { key: "purchasePrice", amount: -state.purchasePrice },
      { key: "monetaryCorrection", amount: -state.purchasePrice * (coefficient - 1) },
      { key: "purchaseCosts", amount: -(state.purchaseCosts ?? 0) },
      { key: "works", amount: -(state.works ?? 0) },
    ];
    const gain = lines.reduce((total, l) => total + l.amount, 0);
    const reinvestBase = salePrice - loanBalance;
    const reinvestedShare =
      state.ownHome && state.reinvestment && reinvestBase > 0
        ? Math.min(1, state.reinvestment / reinvestBase)
        : 0;
    const inclusionRate = params.capitalGains.inclusionRate;
    const taxable = untaxed ? 0 : Math.max(0, gain) * (1 - reinvestedShare) * inclusionRate;
    const other = state.otherTaxableIncome ?? 0;
    gainTax = {
      lines,
      coefficient,
      gain,
      untaxed,
      reinvestedShare,
      inclusionRate,
      taxable,
      otherTaxableIncome: other,
      slices: irsSlicesOnExtraIncome(other, taxable, params),
      tax: irsOnExtraIncome(other, taxable, params),
    };
  }

  return {
    salePrice,
    commissionRate: state.sellingCommissionRate,
    vatRate: params.vatRate,
    commission,
    otherCosts,
    gainTax,
    loanBalance,
    earlyRepaymentFee,
    net:
      salePrice - commission - otherCosts - (gainTax?.tax ?? 0) - loanBalance - earlyRepaymentFee,
  };
}
