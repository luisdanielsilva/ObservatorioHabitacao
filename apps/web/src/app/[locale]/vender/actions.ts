"use server";

import {
  countValuations,
  createValuation,
  getMarketReference,
  updateValuation,
} from "@observatorio-habitacao/db";
import { getDb } from "@/lib/db";
import { canSave, entitlementsFor } from "@/lib/entitlements";
import { FEATURES } from "@/lib/features";
import { getMember } from "@/lib/session";
import { estimateValue } from "@/lib/valuation/estimate";
import { ineBase } from "@/lib/valuation/ine";
import { CONFIDENCE, MODEL_VERSION } from "@/lib/valuation/model";
import { normaliseValuation } from "@/lib/valuation/state";

/** "plan": saving is part of the paid plan (issue #5). */
export type SaveValuationResult =
  { status: "saved"; id: number } | { status: "signin" | "plan" | "limit" | "invalid" | "error" };

const MAX_STATE_BYTES = 100_000;

/**
 * Saves the seller's valuation, new or over their existing one. The state is normalised and
 * the estimate recalculated on the server from the area's INE median, never trusted as sent.
 */
export async function saveValuation(input: {
  id?: number | null;
  name: string;
  state: unknown;
}): Promise<SaveValuationResult> {
  if (!FEATURES.sell) return { status: "error" };
  const user = await getMember();
  if (!user) return { status: "signin" };
  if (!canSave(user.plan)) return { status: "plan" };
  if (JSON.stringify(input.state ?? null).length > MAX_STATE_BYTES) return { status: "invalid" };

  const db = getDb();
  const state = normaliseValuation(input.state);
  const reference =
    state.areaId !== null ? getMarketReference(db, state.areaId, "sale_eur_m2_median") : undefined;
  const valuation = estimateValue(state, ineBase(reference ?? null));
  if (!valuation) return { status: "invalid" };

  const values = {
    name: input.name.trim().slice(0, 120) || "Avaliação",
    areaId: state.areaId,
    input: state as unknown as Record<string, unknown>,
    low: valuation.low,
    likely: valuation.likely,
    high: valuation.high,
    eurPerM2: valuation.perM2,
    confidence: CONFIDENCE[valuation.confidence].score,
    modelVersion: MODEL_VERSION,
  };
  try {
    if (input.id) {
      const updated = updateValuation(db, input.id, user.id, values);
      if (updated) return { status: "saved", id: updated.id };
    }
    if (countValuations(db, user.id) >= entitlementsFor(user.plan).maxSavedScenarios) {
      return { status: "limit" };
    }
    return { status: "saved", id: createValuation(db, user.id, values).id };
  } catch (error) {
    console.error("saveValuation failed", error);
    return { status: "error" };
  }
}
