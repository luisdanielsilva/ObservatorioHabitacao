"use client";

import { useSyncExternalStore } from "react";
import { Calculator, type CalculatorProps } from "@/components/calculator/Calculator";
import { DRAFT_KEY } from "@/components/calculator/SaveBar";
import { normaliseState } from "@/lib/calculator/state";

const subscribe = () => () => {};
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
};

/**
 * Restores inputs kept in the browser while the user signed in to save them (?rascunho=1).
 * The draft is read with useSyncExternalStore (null on the server), and the calculator is
 * remounted with it once it is available. SaveBar clears it once the scenario is saved.
 */
export function CalculatorRoot({
  restoreDraft,
  ...props
}: CalculatorProps & { restoreDraft: boolean }) {
  const raw = useSyncExternalStore(subscribe, readDraft, () => null);
  const draft = restoreDraft && raw ? parseDraft(raw) : null;

  return draft ? (
    <Calculator
      key="draft"
      {...props}
      initial={{ state: draft.state, savedId: null, name: draft.name }}
    />
  ) : (
    <Calculator key="default" {...props} />
  );
}

function parseDraft(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; state?: unknown };
    return {
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 120) : null,
      state: normaliseState(parsed.state),
    };
  } catch {
    return null;
  }
}
