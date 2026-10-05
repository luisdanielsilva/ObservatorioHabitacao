export { acquisitionCosts, imt, roundCents } from "./acquisition";
export type { AcquisitionCosts, AcquisitionInput } from "./acquisition";
export { amortize, monthlyPayment } from "./financing";
export type { Loan, LoanMonth } from "./financing";
export { annualise, irr, npv } from "./metrics";
export { irsOnExtraIncome, irsTax } from "./tax";
export type { ImtBracket, ParameterSet, PropertyUse, Region } from "./params";
export type {
  MonthLine,
  PropertyInputs,
  ScenarioKind,
  ScenarioResult,
  Warning,
} from "./simulation";
export { runFlip } from "./scenarios/flip";
export type { FlipInputs } from "./scenarios/flip";
export { rentalIncomeTaxRate, runLongTermRental } from "./scenarios/longTermRental";
export type { LongTermRentalInputs, RentalTax } from "./scenarios/longTermRental";
export { runShortTermRental } from "./scenarios/shortTermRental";
export type { AlRegistrationStatus, ShortTermRentalInputs } from "./scenarios/shortTermRental";
export { runContractAssignment, suggestAssignmentPrice } from "./scenarios/contractAssignment";
export type { ContractAssignmentInputs } from "./scenarios/contractAssignment";
export {
  sensitivity,
  shiftAdr,
  shiftInterestRate,
  shiftOccupancy,
  shiftPurchasePrice,
  shiftRent,
} from "./sensitivity";
export type { SensitivityPoint } from "./sensitivity";
export { classifyOpportunity } from "./opportunity";
export type { Opportunity, OpportunitySignal } from "./opportunity";
export { seasonsToMonths } from "./seasons";
export type { Seasonal } from "./seasons";
