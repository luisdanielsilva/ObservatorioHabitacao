"use client";

import { useState, useSyncExternalStore } from "react";
import { Calculator, type CalculatorProps } from "@/components/calculator/Calculator";
import { useRouter } from "@/i18n/navigation";
import { clearDraft, readDraft } from "@/lib/calculator/draft";

const subscribe = () => () => {};

/**
 * Keeps the evaluation in progress across the site: the calculator saves it in this browser as
 * the user works (lib/calculator/draft), and it is restored here when the page is opened again.
 *
 * The draft can only be read in the browser, so the server renders a placeholder and the
 * calculator is created once, on the client, from the draft (or empty). Creating it on the
 * server first would autosave an empty evaluation over the user's draft.
 */
export function CalculatorRoot({
  restoreDraft,
  ...props
}: CalculatorProps & {
  /** Restore the evaluation in progress (not when opening a saved scenario or a new link). */
  restoreDraft: boolean;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [generation, setGeneration] = useState(0);
  const router = useRouter();

  if (!isClient) return <CalculatorPlaceholder />;
  return (
    <ClientCalculator
      key={generation}
      {...props}
      restoreDraft={restoreDraft}
      onReset={() => {
        clearDraft();
        router.replace("/avaliar");
        setGeneration((g) => g + 1);
      }}
    />
  );
}

function ClientCalculator({ restoreDraft, ...props }: CalculatorProps & { restoreDraft: boolean }) {
  // Read once, when this calculator is created; the calculator keeps it up to date afterwards.
  const [draft] = useState(() => (restoreDraft ? readDraft() : null));
  return (
    <Calculator
      {...props}
      initial={
        draft ? { state: draft.state, savedId: draft.savedId, name: draft.name } : props.initial
      }
    />
  );
}

/** Same outline as the four steps, while the browser reads the evaluation in progress. */
function CalculatorPlaceholder() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-xl border bg-card/40" />
      ))}
    </div>
  );
}
