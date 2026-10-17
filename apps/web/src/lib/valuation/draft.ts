import { normaliseValuation, type ValuationState } from "./state";

/**
 * The valuation in progress, kept in this browser (like Avaliar anúncio's draft) so it survives
 * moving around the site or signing in to save it. "Nova avaliação" clears it.
 */
export const VALUATION_DRAFT_KEY = "observatorio-habitacao:valuation-draft";

export interface ValuationDraft {
  state: ValuationState;
  savedId: number | null;
}

export function readValuationDraft(): ValuationDraft | null {
  try {
    const raw = localStorage.getItem(VALUATION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: unknown; savedId?: unknown };
    if (!parsed?.state) return null;
    const id = parsed.savedId;
    return {
      state: normaliseValuation(parsed.state),
      savedId: typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null,
    };
  } catch {
    return null;
  }
}

export function writeValuationDraft(draft: ValuationDraft): void {
  try {
    localStorage.setItem(VALUATION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Not kept: the valuation still works, it is just lost when leaving the page.
  }
}

export function clearValuationDraft(): void {
  try {
    localStorage.removeItem(VALUATION_DRAFT_KEY);
  } catch {
    // ignore
  }
}
