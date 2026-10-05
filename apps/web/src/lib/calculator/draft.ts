import { normaliseState, type CalculatorState } from "./state";

/**
 * The evaluation in progress, kept in this browser so it survives moving around the site,
 * signing in to save it, or reloading the page. One draft per browser; "Nova avaliação" clears it.
 */
export const DRAFT_KEY = "olhovivo:calculator-draft";

export interface Draft {
  state: CalculatorState;
  /** The saved scenario this evaluation belongs to, if it was saved. */
  savedId: number | null;
  /** A name the user typed before saving, if any. */
  name: string | null;
}

/** Storage can be unavailable (private mode, blocked site data): every access is guarded. */
export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? parseDraft(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraft(draft: Partial<Draft> & { state: CalculatorState }): void {
  try {
    const previous = readDraft();
    const next: Draft = {
      state: draft.state,
      savedId: draft.savedId !== undefined ? draft.savedId : (previous?.savedId ?? null),
      name: draft.name !== undefined ? draft.name : (previous?.name ?? null),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch {
    // Not kept: the evaluation still works, it is just lost when leaving the page.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Rebuilds a draft from stored JSON, validating every value. */
export function parseDraft(raw: string): Draft | null {
  try {
    const parsed = JSON.parse(raw) as { state?: unknown; savedId?: unknown; name?: unknown };
    if (!parsed || typeof parsed !== "object" || !parsed.state) return null;
    const savedId =
      typeof parsed.savedId === "number" && Number.isInteger(parsed.savedId) && parsed.savedId > 0
        ? parsed.savedId
        : null;
    return {
      state: normaliseState(parsed.state),
      savedId,
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 120) : null,
    };
  } catch {
    return null;
  }
}
