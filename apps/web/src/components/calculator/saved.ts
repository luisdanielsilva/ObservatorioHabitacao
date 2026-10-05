import type { CalculatorState } from "@/lib/calculator/state";

/** A saved scenario: its id, what it was saved with, and its read-only link. */
export interface SavedScenario {
  id: number;
  /** scenarioKey() of the name and inputs at the last save; null when unknown. */
  key: string | null;
  /** The read-only link's token; null when the link is off. */
  token: string | null;
}

/** Identifies a name and inputs, to tell whether what is on screen is what was saved. */
export function scenarioKey(name: string, state: CalculatorState): string {
  return JSON.stringify([name, state]);
}
