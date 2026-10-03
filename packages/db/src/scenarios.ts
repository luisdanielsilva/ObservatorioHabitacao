import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Db } from "./client";
import { scenarios } from "./schema";

/**
 * Saved scenarios (WBS 6.3.2). Every function that reads or changes a scenario checks that it
 * belongs to the given user; shared scenarios are read only through their share token.
 */
export type ScenarioRow = typeof scenarios.$inferSelect;

export interface ScenarioInput {
  name: string;
  property: Record<string, unknown>;
  inputs: Record<string, unknown>;
  results: Record<string, unknown> | null;
  parameterSetId: number;
  analysisId?: number | null;
}

export function countScenarios(db: Db, userId: string): number {
  return (
    db.select({ n: count() }).from(scenarios).where(eq(scenarios.userId, userId)).get()?.n ?? 0
  );
}

export function listScenarios(db: Db, userId: string): ScenarioRow[] {
  return db
    .select()
    .from(scenarios)
    .where(eq(scenarios.userId, userId))
    .orderBy(desc(scenarios.updatedAt), desc(scenarios.id))
    .all();
}

export function getScenario(db: Db, id: number, userId: string): ScenarioRow | undefined {
  return db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.id, id), eq(scenarios.userId, userId)))
    .get();
}

export function createScenario(db: Db, userId: string, input: ScenarioInput): ScenarioRow {
  return db
    .insert(scenarios)
    .values({ ...input, userId, analysisId: input.analysisId ?? null })
    .returning()
    .get();
}

/** Updates the user's scenario; returns undefined when it does not exist or is not theirs. */
export function updateScenario(
  db: Db,
  id: number,
  userId: string,
  input: Partial<ScenarioInput>,
): ScenarioRow | undefined {
  return db
    .update(scenarios)
    .set({ ...input, updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
    .where(and(eq(scenarios.id, id), eq(scenarios.userId, userId)))
    .returning()
    .get();
}

export function duplicateScenario(
  db: Db,
  id: number,
  userId: string,
  name: string,
): ScenarioRow | undefined {
  const original = getScenario(db, id, userId);
  if (!original) return undefined;
  return db
    .insert(scenarios)
    .values({
      userId,
      name,
      property: original.property,
      inputs: original.inputs,
      results: original.results,
      parameterSetId: original.parameterSetId,
      analysisId: original.analysisId,
      listingId: original.listingId,
      duplicatedFromId: original.id,
    })
    .returning()
    .get();
}

export function deleteScenario(db: Db, id: number, userId: string): boolean {
  return (
    db
      .delete(scenarios)
      .where(and(eq(scenarios.id, id), eq(scenarios.userId, userId)))
      .run().changes > 0
  );
}

/**
 * Turns public sharing on (returns the token, creating one if needed) or off (returns null).
 * Turning sharing off and on again creates a new token, so old links stop working.
 */
export function setScenarioSharing(
  db: Db,
  id: number,
  userId: string,
  shared: boolean,
): string | null | undefined {
  const scenario = getScenario(db, id, userId);
  if (!scenario) return undefined;
  const token = shared ? (scenario.shareToken ?? randomBytes(12).toString("base64url")) : null;
  db.update(scenarios).set({ shareToken: token }).where(eq(scenarios.id, id)).run();
  return token;
}

export function getSharedScenario(db: Db, token: string): ScenarioRow | undefined {
  if (!/^[\w-]{16}$/.test(token)) return undefined;
  return db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.shareToken, token), isNotNull(scenarios.shareToken)))
    .get();
}
