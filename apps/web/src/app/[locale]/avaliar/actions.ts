"use server";

import {
  countScenarios,
  createScenario,
  duplicateScenario,
  getActiveParameterSet,
  updateScenario,
} from "@olhovivo/db";
import { getDb } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { runCalculator } from "@/lib/calculator/run";
import { normaliseState } from "@/lib/calculator/state";
import { propertySnapshot, summariseOutput } from "@/lib/calculator/summary";
import { getCurrentUser } from "@/lib/session";

export type SaveResult =
  { status: "saved"; id: number } | { status: "signin" | "limit" | "invalid" | "error" };

const MAX_STATE_BYTES = 100_000;

/**
 * Saves the calculator state as a new scenario or over the user's existing one (WBS 6.3.2).
 * The state is normalised and the results recalculated on the server, never trusted as sent.
 */
export async function saveScenario(input: {
  id?: number | null;
  name: string;
  state: unknown;
}): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "signin" };
  if (JSON.stringify(input.state ?? null).length > MAX_STATE_BYTES) return { status: "invalid" };

  const db = getDb();
  const params = getActiveParameterSet(db, "continente", new Date().getFullYear());
  if (!params) return { status: "error" };

  const state = normaliseState(input.state);
  const name = input.name.trim().slice(0, 120) || "Cenário";
  try {
    const output = runCalculator(state, params.data, new Date().getMonth() + 1);
    const values = {
      name,
      property: propertySnapshot(state),
      inputs: state as unknown as Record<string, unknown>,
      results: summariseOutput(output) as unknown as Record<string, unknown>,
      parameterSetId: params.id,
    };

    if (input.id) {
      const updated = updateScenario(db, input.id, user.id, values);
      if (updated) return { status: "saved", id: updated.id };
    }
    if (countScenarios(db, user.id) >= entitlementsFor(user.plan).maxSavedScenarios) {
      return { status: "limit" };
    }
    return { status: "saved", id: createScenario(db, user.id, values).id };
  } catch (error) {
    console.error("saveScenario failed", error);
    return { status: "error" };
  }
}

export async function duplicateSavedScenario(id: number, name: string): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "signin" };
  const db = getDb();
  if (countScenarios(db, user.id) >= entitlementsFor(user.plan).maxSavedScenarios) {
    return { status: "limit" };
  }
  const copy = duplicateScenario(db, id, user.id, name.trim().slice(0, 120) || "Cópia");
  return copy ? { status: "saved", id: copy.id } : { status: "invalid" };
}
