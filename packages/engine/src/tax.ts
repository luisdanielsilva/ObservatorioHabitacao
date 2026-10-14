import type { ParameterSet } from "./params";

/**
 * IRS on a taxable income for a single taxpayer: the general progressive rates (CIRS art. 68)
 * plus the solidarity surcharge (art. 68-A). Joint filing and deductions are not modelled.
 */
export function irsTax(taxableIncome: number, params: ParameterSet): number {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of params.irs.brackets) {
    const top = upTo ?? Infinity;
    if (income > lower) tax += (Math.min(income, top) - lower) * rate;
    lower = top;
  }
  const surcharges = params.irs.solidarity;
  surcharges.forEach(({ over, rate }, i) => {
    const top = surcharges[i + 1]?.over ?? Infinity;
    if (income > over) tax += (Math.min(income, top) - over) * rate;
  });
  return tax;
}

/**
 * The extra IRS due when `extraIncome` is added to the taxpayer's other taxable income
 * (englobamento): the difference between the tax with and without it.
 */
export function irsOnExtraIncome(
  otherTaxableIncome: number,
  extraIncome: number,
  params: ParameterSet,
): number {
  const other = Math.max(0, otherTaxableIncome);
  return irsTax(other + Math.max(0, extraIncome), params) - irsTax(other, params);
}

/**
 * How `extraIncome` added to the taxpayer's other taxable income is taxed: the part of it in
 * each IRS bracket (and each solidarity surcharge band) and the tax on that part. The taxes
 * add up to `irsOnExtraIncome`.
 */
export interface IrsSlice {
  /** 1-based IRS bracket (escalão); null for a solidarity surcharge band. */
  bracket: number | null;
  rate: number;
  amount: number;
  tax: number;
}

export function irsSlicesOnExtraIncome(
  otherTaxableIncome: number,
  extraIncome: number,
  params: ParameterSet,
): IrsSlice[] {
  const from = Math.max(0, otherTaxableIncome);
  const to = from + Math.max(0, extraIncome);
  const slices: IrsSlice[] = [];
  const add = (bracket: number | null, lower: number, upper: number, rate: number) => {
    const amount = Math.min(to, upper) - Math.max(from, lower);
    if (amount > 0) slices.push({ bracket, rate, amount, tax: amount * rate });
  };
  let lower = 0;
  params.irs.brackets.forEach(({ upTo, rate }, i) => {
    const upper = upTo ?? Infinity;
    add(i + 1, lower, upper, rate);
    lower = upper;
  });
  const surcharges = params.irs.solidarity;
  surcharges.forEach(({ over, rate }, i) =>
    add(null, over, surcharges[i + 1]?.over ?? Infinity, rate),
  );
  return slices;
}

/** An amount that makes up a taxable gain: positive when received, negative when deducted. */
export type GainLineKey =
  | "salePrice"
  | "assignmentPrice"
  | "deposit"
  | "sellingCommission"
  | "otherCosts"
  | "purchasePrice"
  | "acquisitionCosts"
  | "upfrontTaxes"
  | "renovation";

/**
 * The IRS on a sale's gain (mais-valia, category G), with the figures it comes from: the gain,
 * the share of it that is taxed, and how that share is taxed on top of the other income.
 */
export interface GainTax {
  /** `rate`: the commission's rate, excluding VAT. */
  lines: { key: GainLineKey; amount: number; rate?: number }[];
  /** The sum of the lines; when not positive, there is no tax. */
  gain: number;
  inclusionRate: number;
  /** The share of a positive gain added to the taxable income. */
  taxable: number;
  otherTaxableIncome: number;
  slices: IrsSlice[];
  tax: number;
}

export function gainTax(
  lines: GainTax["lines"],
  inclusionRate: number,
  otherTaxableIncome: number,
  params: ParameterSet,
): GainTax {
  const gain = lines.reduce((total, line) => total + line.amount, 0);
  const taxable = Math.max(0, gain) * inclusionRate;
  return {
    lines,
    gain,
    inclusionRate,
    taxable,
    otherTaxableIncome: Math.max(0, otherTaxableIncome),
    slices: irsSlicesOnExtraIncome(otherTaxableIncome, taxable, params),
    tax: irsOnExtraIncome(otherTaxableIncome, taxable, params),
  };
}
