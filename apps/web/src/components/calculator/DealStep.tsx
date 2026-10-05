"use client";

import type { ScenarioKind } from "@olhovivo/engine";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { SCENARIO_KINDS } from "@/lib/calculator/run";
import { normaliseDeals } from "@/lib/calculator/state";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./CashFlowChart";

/** Step 2: one or more deals to evaluate; their details are then filled in one after another. */
export function DealStep({
  deals,
  onChange,
  onContinue,
}: {
  deals: ScenarioKind[];
  onChange: (deals: ScenarioKind[]) => void;
  onContinue: () => void;
}) {
  const t = useTranslations("evaluate");
  const ts = useTranslations("scenarios");
  const id = useId();
  const [tried, setTried] = useState(false);

  const toggle = (kind: ScenarioKind) =>
    onChange(
      normaliseDeals(deals.includes(kind) ? deals.filter((d) => d !== kind) : [...deals, kind]),
    );

  return (
    <>
      <p id={`${id}-question`} className="text-sm text-muted-foreground">
        {t("dealQuestion")}
      </p>
      <div role="group" aria-labelledby={`${id}-question`} className="grid gap-3 sm:grid-cols-2">
        {SCENARIO_KINDS.map((kind) => {
          const checked = deals.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(kind)}
              className={cn(
                "flex gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                checked && "border-primary bg-primary/5",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                  checked && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {checked && <Check className="size-3.5" />}
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: SCENARIO_COLORS[kind] }}
                  />
                  {t(`deals.${kind}`)}
                </span>
                <span className="text-sm text-muted-foreground">{ts(`${kind}Text`)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {tried && deals.length === 0
            ? t("chooseAtLeastOne")
            : deals.length > 1
              ? t("dealsChosen", { count: deals.length })
              : t("severalDealsHint")}
        </p>
        <Button
          className="shrink-0"
          onClick={() => {
            setTried(true);
            if (deals.length > 0) onContinue();
          }}
        >
          {t("continue")}
        </Button>
      </div>
    </>
  );
}
