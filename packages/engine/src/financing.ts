/** A fixed-payment (annuity) mortgage, the standard in Portugal. */
export interface Loan {
  amount: number;
  /** Annual rate: nominal (TAN, e.g. Euribor + spread) or TAEG, see `rateType`. */
  annualRate: number;
  termYears: number;
  /**
   * "taeg": the rate is the loan's global rate, so no stamp duty is added to each interest
   * payment. One-off costs at signing (stamp duty on the loan, valuation and process opening
   * fees, mortgage registration) are still acquisition costs. Defaults to "tan".
   */
  rateType?: "tan" | "taeg";
}

export interface LoanMonth {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  /** Imposto do Selo on the interest, charged on top of the payment. */
  stampDuty: number;
  /** Outstanding balance after this month's payment. */
  balance: number;
}

/** Monthly instalment of an annuity loan; the monthly rate is TAN ÷ 12. */
export function monthlyPayment(amount: number, annualRate: number, termMonths: number): number {
  if (amount <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return amount / termMonths;
  return (amount * r) / (1 - (1 + r) ** -termMonths);
}

/**
 * Amortisation schedule for the first `months` months (or until the loan is repaid).
 * `interestStampDutyRate` is the Imposto do Selo charged on each interest payment.
 */
export function amortize(loan: Loan, months: number, interestStampDutyRate: number): LoanMonth[] {
  const termMonths = Math.round(loan.termYears * 12);
  const payment = monthlyPayment(loan.amount, loan.annualRate, termMonths);
  const r = loan.annualRate / 12;
  const schedule: LoanMonth[] = [];
  let balance = loan.amount;

  for (let month = 1; month <= Math.min(months, termMonths) && balance > 0; month++) {
    const interest = balance * r;
    const principal = Math.min(payment - interest, balance);
    balance = month === termMonths ? 0 : balance - principal;
    schedule.push({
      month,
      payment: interest + principal,
      interest,
      principal,
      stampDuty: interest * interestStampDutyRate,
      balance,
    });
  }
  return schedule;
}
