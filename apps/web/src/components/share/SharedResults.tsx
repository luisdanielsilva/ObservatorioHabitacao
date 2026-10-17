"use client";

import type { ParameterSet, ScenarioKind } from "@observatorio-habitacao/engine";
import { useTranslations } from "next-intl";
import { Results } from "@/components/calculator/Results";
import { SaleChart } from "@/components/calculator/SaleChart";
import { Disclaimer } from "@/components/shared/Disclaimer";
import type { CalculatorOutput } from "@/lib/calculator/run";
import type { CalculatorState } from "@/lib/calculator/state";

/**
 * Read-only results of a shared scenario: the deals its author chose, side by side, and what
 * each deal's sale must bring in.
 */
export function SharedResults({
  output,
  deals,
  state,
  params,
  startMonth,
  paramsYear,
}: {
  output: CalculatorOutput;
  deals: ScenarioKind[];
  state: CalculatorState;
  params: ParameterSet;
  startMonth: number;
  paramsYear: number;
}) {
  const t = useTranslations("evaluate");
  const withResults = deals.filter((d) => output.outcomes.some((o) => o.kind === d && o.result));
  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <Results output={output} only={deals.length > 0 ? deals : undefined} />
      {withResults.map((deal) => (
        <div key={deal} className="space-y-2">
          {withResults.length > 1 && (
            <h3 className="text-sm font-semibold">{t(`deals.${deal}`)}</h3>
          )}
          <SaleChart deal={deal} state={state} params={params} startMonth={startMonth} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("parameters", { year: paramsYear })}</p>
      <Disclaimer />
    </div>
  );
}
