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
