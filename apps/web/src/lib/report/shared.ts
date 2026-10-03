import "server-only";
import { getSharedScenario } from "@olhovivo/db";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { buildReportData } from "./data";

/** A shared scenario and its recalculated results, once per request. */
export const loadSharedScenario = cache((token: string) => {
  const scenario = getSharedScenario(getDb(), token);
  if (!scenario) return undefined;
  const data = buildReportData(scenario);
  return data ? { scenario, data } : undefined;
});
