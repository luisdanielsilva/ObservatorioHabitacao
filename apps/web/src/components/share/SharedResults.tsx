"use client";

import type { ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { Results } from "@/components/calculator/Results";
import { Disclaimer } from "@/components/shared/Disclaimer";
import type { CalculatorOutput } from "@/lib/calculator/run";

/** Read-only results of a shared scenario: the deals its author chose, side by side. */
export function SharedResults({
  output,
  deals,
  paramsYear,
}: {
  output: CalculatorOutput;
  deals: ScenarioKind[];
  paramsYear: number;
}) {
  const t = useTranslations("evaluate");
  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <Results output={output} only={deals.length > 0 ? deals : undefined} />
      <p className="text-xs text-muted-foreground">{t("parameters", { year: paramsYear })}</p>
      <Disclaimer />
    </div>
  );
}
