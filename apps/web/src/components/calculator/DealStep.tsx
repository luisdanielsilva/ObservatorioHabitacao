"use client";

import type { ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { SCENARIO_KINDS } from "@/lib/calculator/run";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./CashFlowChart";

/** Step 2: which deal to evaluate. Choosing one moves on to its details. */
export function DealStep({
  deal,
  onChoose,
}: {
  deal: ScenarioKind | null;
  onChoose: (deal: ScenarioKind) => void;
}) {
  const t = useTranslations("evaluate");
  const ts = useTranslations("scenarios");

  return (
    <div role="radiogroup" aria-label={t("dealQuestion")} className="grid gap-3 sm:grid-cols-2">
      {SCENARIO_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={deal === kind}
          onClick={() => onChoose(kind)}
          className={cn(
            "flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            deal === kind && "border-primary bg-primary/5",
          )}
        >
          <span className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: SCENARIO_COLORS[kind] }}
            />
            {t(`deals.${kind}`)}
          </span>
          <span className="text-sm text-muted-foreground">{ts(`${kind}Text`)}</span>
        </button>
      ))}
    </div>
  );
}
