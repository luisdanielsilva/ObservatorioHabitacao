"use client";

import { compareScenarios, type Goal } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Results } from "@/components/calculator/Results";
import { Disclaimer } from "@/components/shared/Disclaimer";
import type { CalculatorOutput } from "@/lib/calculator/run";

/** Read-only results of a shared scenario; the visitor can still switch the goal. */
export function SharedResults({
  output,
  initialGoal,
  paramsYear,
}: {
  output: CalculatorOutput;
  initialGoal: Goal;
  paramsYear: number;
}) {
  const t = useTranslations("evaluate");
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const shown = useMemo(() => {
    const results = output.outcomes.flatMap((o) => (o.result ? [o.result] : []));
    return { ...output, comparison: compareScenarios(results, goal) };
  }, [output, goal]);
  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <Results output={shown} goal={goal} onGoalChange={setGoal} />
      <p className="text-xs text-muted-foreground">{t("parameters", { year: paramsYear })}</p>
      <Disclaimer />
    </div>
  );
}
