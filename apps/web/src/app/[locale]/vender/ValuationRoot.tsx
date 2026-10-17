"use client";

import { useState, useSyncExternalStore } from "react";
import { Valuation, type ValuationProps } from "@/components/valuation/Valuation";
import { useRouter } from "@/i18n/navigation";
import { clearValuationDraft, readValuationDraft } from "@/lib/valuation/draft";

const subscribe = () => () => {};

/**
 * Keeps the valuation in progress across the site, like Avaliar anúncio: it is saved in this
 * browser as the seller works and restored here. The draft can only be read in the browser, so
 * the server renders a placeholder and the valuation is created on the client.
 */
export function ValuationRoot({
  restoreDraft,
  ...props
}: ValuationProps & { restoreDraft: boolean }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [generation, setGeneration] = useState(0);
  const router = useRouter();

  if (!isClient) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl border bg-card/40" />
        ))}
      </div>
    );
  }
  return (
    <ClientValuation
      key={generation}
      {...props}
      restoreDraft={restoreDraft}
      onReset={() => {
        clearValuationDraft();
        router.replace("/vender");
        setGeneration((g) => g + 1);
      }}
    />
  );
}

function ClientValuation({ restoreDraft, ...props }: ValuationProps & { restoreDraft: boolean }) {
  const [draft] = useState(() => (restoreDraft ? readValuationDraft() : null));
  return (
    <Valuation
      {...props}
      initial={draft ? { state: draft.state, savedId: draft.savedId, name: null } : props.initial}
    />
  );
}
