import type { ScenarioKind } from "@olhovivo/engine";

/** One chart colour per deal, used in markers, tabs and charts. */
export const SCENARIO_COLORS: Record<ScenarioKind, string> = {
  flip: "var(--chart-2)",
  longTermRental: "var(--chart-1)",
  shortTermRental: "var(--chart-3)",
  contractAssignment: "var(--chart-4)",
};
