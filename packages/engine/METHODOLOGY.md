# Scenario engine — methodology

Status: draft, prepared by the developers. **Not yet reviewed by an accountant or tax advisor**
(WBS 2.3.1, 10.6). Results are estimates, not financial or tax advice.

All tax rates, brackets and typical fees come from a `ParameterSet` (`src/params.ts`), stored
per year and region in the database. Nothing here is hard-coded in the engine.

## Timeline

Every property scenario is simulated month by month:

- **Month 0:** purchase. Cash out = price + acquisition costs + upfront extras (e.g.
  furnishing) − loan.
- **Months 1…R:** renovation; the budget is spread evenly and no rent is earned.
- **Months R+1…H:** operation (rent, holding costs, loan payments, income tax).
- **Month H:** sale. Sale price − agency commission (+ VAT) − loan balance − early repayment
  fee − capital gains tax.

The contract assignment scenario has its own timeline: deposit at month 0, assignment
proceeds at the assignment month.

## Acquisition costs

| Cost                       | Formula                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMT                        | max(price, VPT) × rate − deduction, using the bracket for the property use (own home / other housing); flat rate for other urban and rustic property              |
| IMT (non-resident)         | From 2026-05-20, housing bought by a non-resident: max(price, VPT) × 7.5 % flat (CIMT art. 17 n.º 10). The refund conditions are shown as a warning, not modelled |
| Imposto do Selo (purchase) | max(price, VPT) × 0.8 %                                                                                                                                           |
| Imposto do Selo (loan)     | loan amount × 0.6 %                                                                                                                                               |
| Deed and registry          | typical value from parameters, or user's own figure                                                                                                               |
| Bank fees                  | typical value from parameters, only with a loan                                                                                                                   |

## Financing

Annuity loan, monthly rate = annual rate ÷ 12. With a TAN (`rateType` "tan", the default),
Imposto do Selo of 4 % is added to each interest payment. With a TAEG (`rateType` "taeg", used by
the app as the loan's global rate), it is not. Either way, the one-off costs at signing are
acquisition costs: stamp duty on the loan (0.6 %), the bank's valuation and process opening fees
(inputs; the app defaults to 250 € and 300 €) and the deed and registry with mortgage. The app
finances nothing by default; the term defaults to 30 years, up to 50. On sale, the outstanding balance is repaid plus an early repayment fee
(default 0.5 % for variable-rate loans). A warning is raised when the loan exceeds the
Banco de Portugal LTV limit (90 % own home, 80 % other).

## Metrics

| Metric            | Definition                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Total investment  | price + acquisition costs + renovation + furnishing/registration                                                       |
| Own capital       | total investment − loan                                                                                                |
| Peak capital      | largest cumulative cash outlay, including holding costs                                                                |
| Net profit        | sum of all cash flows after financing and taxes, including the sale                                                    |
| ROI               | net profit ÷ own capital                                                                                               |
| IRR               | IRR of the monthly cash flows, annualised: (1 + monthly)^12 − 1                                                        |
| Gross yield       | annual rent (before vacancy) ÷ (price + acquisition costs)                                                             |
| Net yield         | (rent collected − operating costs − income tax) ÷ total investment, first full year after renovation, before financing |
| Monthly cash flow | (rent collected − operating costs − income tax − loan payments) ÷ 12, first full year                                  |
| Payback           | own capital ÷ annual cash flow, in years; none if cash flow ≤ 0                                                        |
| Return on deposit | contract assignment net profit ÷ deposit                                                                               |

## Scenarios

**Fix & flip.** Holding costs: IMI, condominium, insurance, utilities, loan payments. No
operating income.

**Long-term rental.** Leases of `contractMonths` follow one another, each followed by
`vacancyMonths` without rent; the rent grows yearly (the app defaults to the latest rent update
coefficient published in the Diário da República). The app keeps the property (no sale,
`exitPrice` null) and measures profit and IRR over 30 years, or the loan term if longer. Yields
and monthly cash flow use a typical year: the first year's rent spread over one lease-and-vacancy
cycle. Costs: IMI, condominium,
insurance, maintenance and management (shares of collected rent; the app defaults maintenance
to 10 %). Category F tax on rent
minus those costs (loan interest not deductible): autonomous rate 25 %, reduced to
15 / 10 / 5 % for contracts of 5 / 10 / 20+ years, or englobamento: the net rent is added to the
investor's other taxable income and taxed at the IRS brackets.

**Short-term rental (AL).** Per calendar month: nights = days × occupancy; stays = nights ÷
average stay; bookings = nights × ADR + stays × cleaning fee. VAT (6 %) is removed when the
owner is registered. Costs: platform fee (on bookings), management and maintenance (on
income; the app defaults maintenance to 20 %), cleaning
per stay, consumables per night, utilities, IMI, condominium, insurance. Category B
simplified regime: income × coefficient (0.35; 0.50 in containment zones) is added to the
investor's other taxable income and taxed at the IRS brackets (the extra tax is what is charged). A warning is raised in containment zones and above the VAT exemption threshold; a
municipality that has suspended new registrations makes the scenario non-viable.

**Contract assignment (cessão de posição contratual).** Assignment price = total paid by the
new buyer, including the deposit reimbursement. Premium = assignment price − deposit.
Commission (+ VAT) is charged on the premium. Optionally, IMT and stamp duty on the CPCV
price are paid upfront (when the CPCV allows assignment to a third party). Gain = premium −
commission − other costs − upfront taxes; 50 % is added to other income and taxed at the IRS
brackets. A warning is
raised when the new buyer's total (CPCV price − deposit + assignment price) exceeds market
value. Default assignment price: deposit + 50 % of (market value − CPCV price).

## Capital gains (sale)

Gain = sale price − selling costs − purchase price − (IMT + stamp duty + deed) − renovation.
50 % of a positive gain is added to the investor's other annual taxable income and taxed at the
IRS brackets (CIRS art. 68) plus the solidarity surcharge (art. 68-A): the tax charged is
IRS(other + 50 % × gain) − IRS(other). There is no flat rate on property gains for individuals,
resident or not (the 28 % non-resident rate was revoked in 2023). Other income defaults to 0.

## Comparison and sensitivity

Scenarios are shown side by side with the indicators that apply to them; none is ranked or
recommended — the investor compares and decides. `sensitivity` re-runs a scenario with one input shifted (price, rent, ADR, occupancy,
interest rate).

## Simplifications

- Income tax is paid once per 12-month block, at the end of the block; capital gains tax in
  the month of sale (in reality, in the following year's IRS settlement).
- IMI is accrued monthly (in reality, paid by whoever owns the property on 31 December).
- Rental tax losses are not carried forward between years.
- When the VPT is unknown, the purchase price is used (higher IMI; a warning is raised).
- The loan finances only the purchase, drawn in full at month 0.

## Not modelled yet

- The young buyers' own-home IMT table (CIMT art. 17 n.º 1 b)) and the stamp duty exemption for young buyers (IMT Jovem) and the reinvestment exemption
  for own permanent home.
- Monetary correction coefficients for gains on property held more than 24 months.
- Adicional ao IMI (AIMI), social security on category B income, purchases through a company.
- Capital gains on property used for AL (business assets have different rules).
- Regional tables for the Açores and Madeira (supported by the parameter set, no data yet).

## To verify with a tax advisor

1. The draft 2026 parameter set (read from the Portal das Finanças consolidated codes) and
   the corrected 2025 set (secondary-housing 8 % IMT bracket ends at 621 501 €).
2. Cessão de posição contratual: the 50 % inclusion is confirmed by CIRS art. 43 n.º 2 b) with
   art. 10 n.º 1 d); when IMT is due remains open.
3. Which costs are deductible from category F rental income.
4. AL coefficient in containment zones and VAT rules for AL.
5. Typical deed, registry and bank fees.
