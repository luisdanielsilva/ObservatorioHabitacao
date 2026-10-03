import type { ImtBracket, ParameterSet } from "@olhovivo/engine";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { createParameterSetDraft } from "../queries";
import { parameterSets } from "../schema";
import { parameters2025 } from "../seed/parameters2025";

/**
 * Mainland 2026 parameters (WBS 4.5.5), from the official consolidated codes on the Portal das
 * Finanças, read on 2026-10-03. Stored as a DRAFT: a tax advisor must review it before it is
 * activated (WBS 10.6). Figures without a 2026 source are carried from 2025 and say so in
 * PARAMETERS_2026_NOTES.
 */

const PF = "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios";
export const SOURCES_2026 = {
  imt: `${PF}/cimt/Pages/cimt17.aspx`,
  stampDuty: `${PF}/selo/Pages/ccod-selo-tabgiselo.aspx`,
  rentalIncome: `${PF}/cirs_rep/Pages/irs72.aspx`,
  alCoefficients: `${PF}/cirs_rep/Pages/irs31.aspx`,
  capitalGains: `${PF}/cirs_rep/Pages/irs43.aspx`,
  vatExemption: `${PF}/civa_rep/Pages/artigo-53-o-do-civa.aspx`,
  budgetLaw:
    "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/Lei-73-A-2025.pdf",
} as const;

/**
 * Builds an IMT table in the engine's form (rate × value − deduction) from the law's upper
 * limits and marginal rates. The law (CIMT art. 17 n.º 3) uses average rates instead; both give
 * the same tax, up to the law's rounding of average rates to four decimals.
 *
 * @param progressive upper limits and marginal rates of the progressive brackets
 * @param flat the single-rate brackets that follow
 */
export function imtTable(
  progressive: { upTo: number; rate: number }[],
  flat: { upTo: number | null; rate: number }[],
): ImtBracket[] {
  const table: ImtBracket[] = [];
  let deduction = 0;
  let previous = { upTo: 0, rate: 0 };
  for (const bracket of progressive) {
    deduction += previous.upTo * (bracket.rate - previous.rate);
    table.push({ upTo: bracket.upTo, rate: bracket.rate, deduction: round2(deduction) });
    previous = bracket;
  }
  for (const bracket of flat) table.push({ upTo: bracket.upTo, rate: bracket.rate, deduction: 0 });
  return table;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** CIMT art. 17 n.º 1, as amended by Lei n.º 73-A/2025 (State Budget 2026). */
const IMT_2026 = {
  // a) Own permanent home.
  hpp: imtTable(
    [
      { upTo: 106_346, rate: 0 },
      { upTo: 145_470, rate: 0.02 },
      { upTo: 198_347, rate: 0.05 },
      { upTo: 330_539, rate: 0.07 },
      { upTo: 660_982, rate: 0.08 },
    ],
    [
      { upTo: 1_150_853, rate: 0.06 },
      { upTo: null, rate: 0.075 },
    ],
  ),
  // c) Other housing. Note the 8 % bracket ends lower than for own permanent homes.
  secondary: imtTable(
    [
      { upTo: 106_346, rate: 0.01 },
      { upTo: 145_470, rate: 0.02 },
      { upTo: 198_347, rate: 0.05 },
      { upTo: 330_539, rate: 0.07 },
      { upTo: 633_931, rate: 0.08 },
    ],
    [
      { upTo: 1_150_853, rate: 0.06 },
      { upTo: null, rate: 0.075 },
    ],
  ),
};

export const parameters2026: ParameterSet = {
  ...parameters2025,
  year: 2026,
  region: "continente",
  imt: {
    hpp: IMT_2026.hpp,
    secondary: IMT_2026.secondary,
    otherUrbanRate: 0.065, // art. 17 n.º 1 e)
    rusticRate: 0.05, // art. 17 n.º 1 d)
    // art. 17 n.º 10 (Decreto-Lei n.º 97/2026, from 2026-05-20): non-resident buyers of housing.
    nonResidentHousingRate: 0.075,
  },
  // TGIS verbas 1.1 (0.8 %), 17.1.3 (0.6 %, loans of 5 years or more), 17.3.1 (4 %).
  stampDuty: { purchaseRate: 0.008, loanRate: 0.006, interestRate: 0.04 },
  // CIRS art. 72 n.os 2–5: 25 %, reduced by 10 / 15 / 20 points.
  rentalIncome: {
    autonomousRate: 0.25,
    longContractRates: [
      { minYears: 5, rate: 0.15 },
      { minYears: 10, rate: 0.1 },
      { minYears: 20, rate: 0.05 },
    ],
  },
  // CIRS art. 31 n.º 1 c) (0.35, services not listed elsewhere; AL is excluded from a)) and h)
  // (0.50 in containment areas). CIVA art. 53 n.º 1: 15 000 € threshold.
  localAccommodation: {
    coefficient: 0.35,
    containmentZoneCoefficient: 0.5,
    vatRate: 0.06,
    vatExemptionThreshold: 15_000,
  },
  // CIRS art. 43 n.º 2 b): 50 % of gains from art. 10 n.º 1 a) (sale of property) and
  // d) (paid assignment of contractual positions on property).
  capitalGains: { inclusionRate: 0.5 },
  contractAssignment: { inclusionRate: 0.5 },
};

export const PARAMETERS_2026_NOTES = [
  "Draft 2026 mainland parameters, read from the Portal das Finanças consolidated codes on 2026-10-03. Not yet reviewed by a tax advisor.",
  `IMT tables (hpp, secondary), 6.5 % other urban, 5 % rustic: CIMT art. 17 n.º 1 as amended by Lei n.º 73-A/2025 — ${SOURCES_2026.imt}`,
  `Stamp duty 0.8 % / 0.6 % / 4 %: TGIS verbas 1.1, 17.1.3, 17.3.1 — ${SOURCES_2026.stampDuty}`,
  `Rental income 25 % with 10/15/20-point reductions: CIRS art. 72 n.os 2–5 — ${SOURCES_2026.rentalIncome}`,
  `AL coefficients 0.35 / 0.50 (containment): CIRS art. 31 n.º 1 c) and h) — ${SOURCES_2026.alCoefficients}`,
  `Capital gains and contract assignment 50 %: CIRS art. 43 n.º 2 b) with art. 10 n.º 1 a) and d) — ${SOURCES_2026.capitalGains}`,
  `VAT exemption threshold 15 000 €: CIVA art. 53 n.º 1 — ${SOURCES_2026.vatExemption}`,
  "CARRIED FROM 2025 (no 2026 source checked): AL VAT rate 6 %, standard VAT 23 %, typical deed/registry and bank fees, Banco de Portugal LTV limits (90 % / 80 %), early repayment fee 0.5 %, typical spread 1 %.",
  "Non-resident housing IMT 7.5 % flat: CIMT art. 17 n.º 10 (Decreto-Lei n.º 97/2026, from 2026-05-20). The refund conditions (residency within 2 years, or letting at capped rents) are shown as a warning, not modelled.",
  "NOT MODELLED: CIMT art. 17 n.º 1 b) (young buyers' own home table).",
].join("\n");

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

/** Stores `data` as a new draft unless an identical version exists. Never activates. */
export function storeDraftIfNew(db: Db, data: ParameterSet, notes: string) {
  const existing = db
    .select()
    .from(parameterSets)
    .where(and(eq(parameterSets.year, data.year), eq(parameterSets.region, data.region)))
    .all();
  const same = existing.find((row) => stable(row.data) === stable(data));
  if (same) return { created: false as const, row: same };
  return { created: true as const, row: createParameterSetDraft(db, data, notes) };
}
