"use client";

import { compareScenarios, type Goal } from "@olhovivo/engine";
import { useMemo, useState } from "react";
import { Results } from "@/components/calculator/Results";
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
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const shown = useMemo(() => {
    const results = output.outcomes.flatMap((o) => (o.result ? [o.result] : []));
    return { ...output, comparison: compareScenarios(results, goal) };
  }, [output, goal]);
  return <Results output={shown} goal={goal} onGoalChange={setGoal} paramsYear={paramsYear} />;
}
