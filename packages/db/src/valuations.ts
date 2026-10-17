import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { valuations } from "./schema";

/**
 * Saved seller valuations (Vender). Like scenarios, every function checks that the valuation
 * belongs to the given user. `input` is the seller's property and sale as entered; the figures
 * are what the estimate gave when saved, recalculated from `input` whenever it is opened.
 */
export type ValuationRow = typeof valuations.$inferSelect;

export interface ValuationInput {
  name: string;
  areaId: number | null;
  input: Record<string, unknown>;
  low: number;
  likely: number;
  high: number;
  eurPerM2: number;
  confidence: number;
  modelVersion: string;
}

const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export function countValuations(db: Db, userId: string): number {
  return (
    db.select({ n: count() }).from(valuations).where(eq(valuations.userId, userId)).get()?.n ?? 0
  );
}

export function listValuations(db: Db, userId: string): ValuationRow[] {
  return db
    .select()
    .from(valuations)
    .where(eq(valuations.userId, userId))
    .orderBy(desc(valuations.updatedAt), desc(valuations.id))
    .all();
}

export function getValuation(db: Db, id: number, userId: string): ValuationRow | undefined {
  return db
    .select()
    .from(valuations)
    .where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
    .get();
}

export function createValuation(db: Db, userId: string, input: ValuationInput): ValuationRow {
  return db
    .insert(valuations)
    .values({ ...input, userId, updatedAt: now() })
    .returning()
    .get();
}

/** Updates the user's valuation; undefined when it does not exist or is not theirs. */
export function updateValuation(
  db: Db,
  id: number,
  userId: string,
  input: ValuationInput,
): ValuationRow | undefined {
  return db
    .update(valuations)
    .set({ ...input, updatedAt: now() })
    .where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
    .returning()
    .get();
}

export function deleteValuation(db: Db, id: number, userId: string): boolean {
  return (
    db
      .delete(valuations)
      .where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
      .run().changes > 0
  );
}
