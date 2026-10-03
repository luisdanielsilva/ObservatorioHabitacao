import type { ParameterSet } from "@olhovivo/engine";
import { z } from "zod";

const rate = z.number().min(0).max(1);
const amount = z.number().min(0);

const imtTable = z
  .array(z.object({ upTo: z.number().positive().nullable(), rate, deduction: amount }))
  .min(1)
  .refine((brackets) => brackets.at(-1)!.upTo === null, "last bracket must be open-ended")
  .refine(
    (brackets) =>
      brackets.every((b, i) => i === 0 || (b.upTo ?? Infinity) > (brackets[i - 1]!.upTo ?? 0)),
    "brackets must be in ascending order",
  );

/** Validates a ParameterSet before it is stored; mirrors `ParameterSet` in the engine. */
export const parameterSetSchema: z.ZodType<ParameterSet> = z.object({
  year: z.number().int().min(2000).max(2100),
  region: z.enum(["continente", "acores", "madeira"]),
  imt: z.object({
    hpp: imtTable,
    secondary: imtTable,
    otherUrbanRate: rate,
    rusticRate: rate,
    nonResidentHousingRate: rate.optional(),
  }),
  stampDuty: z.object({ purchaseRate: rate, loanRate: rate, interestRate: rate }),
  transactionFees: z.object({
    deedAndRegistry: amount,
    deedAndRegistryWithMortgage: amount,
    bankFees: amount,
  }),
  financing: z.object({
    maxLtv: z.object({ hpp: rate, other: rate }),
    earlyRepaymentFeeRate: rate,
    typicalSpread: rate,
  }),
  vatRate: rate,
  rentalIncome: z.object({
    autonomousRate: rate,
    longContractRates: z.array(z.object({ minYears: z.number().int().positive(), rate })),
  }),
  localAccommodation: z.object({
    coefficient: rate,
    containmentZoneCoefficient: rate,
    vatRate: rate,
    vatExemptionThreshold: amount,
  }),
  capitalGains: z.object({ inclusionRate: rate }),
  contractAssignment: z.object({ inclusionRate: rate }),
});
