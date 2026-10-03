import "server-only";
import {
  getAreaBreadcrumb,
  getMarketReference,
  parameterSets,
  type MarketReferenceValue,
  type ScenarioRow,
} from "@olhovivo/db";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runCalculator, type CalculatorOutput } from "@/lib/calculator/run";
import { normaliseState, type CalculatorState } from "@/lib/calculator/state";

export interface ReportData {
  name: string;
  state: CalculatorState;
  output: CalculatorOutput;
  breadcrumb: string[];
  reference: { sale: MarketReferenceValue | null; rent: MarketReferenceValue | null };
  parametersYear: number;
  parametersVerified: boolean;
  updatedAt: string;
}

/**
 * Everything a report or shared page needs for a saved scenario. Results are recalculated
 * from the stored inputs with the parameter set the scenario was saved with, never taken
 * from the stored results cache.
 */
export function buildReportData(scenario: ScenarioRow): ReportData | undefined {
  const db = getDb();
  const params = db
    .select()
    .from(parameterSets)
    .where(eq(parameterSets.id, scenario.parameterSetId))
    .get();
  if (!params) return undefined;

  const state = normaliseState(scenario.inputs);
  const startMonth = Number(scenario.updatedAt.slice(5, 7)) || 1;
  const output = runCalculator(state, params.data, startMonth);
  const areaId = state.areaId;

  return {
    name: scenario.name,
    state,
    output,
    breadcrumb: areaId ? getAreaBreadcrumb(db, areaId).map((a) => a.name) : [],
    reference: {
      sale: areaId ? (getMarketReference(db, areaId, "sale_eur_m2_median") ?? null) : null,
      rent: areaId ? (getMarketReference(db, areaId, "rent_eur_m2_median") ?? null) : null,
    },
    parametersYear: params.year,
    parametersVerified: params.verifiedAt !== null,
    updatedAt: scenario.updatedAt,
  };
}
