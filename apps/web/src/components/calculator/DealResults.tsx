"use client";

import type { Goal, ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { HelpTip } from "@/components/shared/HelpTip";
import type { CalculatorOutput } from "@/lib/calculator/run";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { CashFlowChart } from "./CashFlowChart";
import { formatMetric, METRICS, Results, ScenarioDetails, type MetricKey } from "./Results";
import { Sensitivity } from "./Sensitivity";

/** The indicators that matter most for each deal, in order. */
const HEADLINE: Record<ScenarioKind, MetricKey[]> = {
  flip: ["netProfit", "roi", "irr", "totalInvestment", "ownCapital", "peakCapital"],
  longTermRental: [
    "monthlyCashFlow",
    "grossYield",
    "netYield",
    "irr",
    "paybackYears",
    "netProfit",
    "ownCapital",
    "totalInvestment",
  ],
  shortTermRental: [
    "monthlyCashFlow",
    "grossYield",
    "netYield",
    "irr",
    "paybackYears",
    "netProfit",
    "ownCapital",
    "totalInvestment",
  ],
  contractAssignment: ["netProfit", "returnOnDeposit", "irr", "ownCapital"],
};

/** Step 4: the chosen deal's results, its sensitivity, and the comparison on request. */
export function DealResults({
  deal,
  output,
  state,
  params,
  startMonth,
  onGoalChange,
  onFillMissing,
}: {
  deal: ScenarioKind;
  output: CalculatorOutput | null;
  state: CalculatorState;
  params: ParameterSet | null;
  startMonth: number;
  onGoalChange: (goal: Goal) => void;
  onFillMissing: (kind: ScenarioKind) => void;
}) {
  const t = useTranslations("evaluate");
  const tm = useTranslations("metrics");
  const f = useFormat();
  const id = useId();
  const [comparing, setComparing] = useState(false);

  const outcome = output?.outcomes.find((o) => o.kind === deal);
  if (!output || !outcome?.result) {
    return <p className="text-sm text-muted-foreground">{t("noParameters")}</p>;
  }
  const result = outcome.result;
  const format = (key: MetricKey) => METRICS.find((m) => m.key === key)!.format;
  const opportunity = output.opportunity;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!result.viable && <Badge variant="destructive">{t("notViable")}</Badge>}
        {opportunity && (
          <>
            <Badge
              className={cn(
                opportunity.signal === "opportunity" && "bg-positive text-background",
                opportunity.signal === "fair" && "bg-secondary text-secondary-foreground",
                opportunity.signal === "above" && "bg-destructive text-white",
              )}
            >
              {t(`opportunity.${opportunity.signal}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("opportunity.text", { diff: f.signedPercent(opportunity.difference) })}
            </span>
          </>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HEADLINE[deal].map((key, i) => {
          const value = result[key];
          return (
            <div
              key={key}
              className={cn("rounded-lg border p-3", i === 0 && "border-primary/50 bg-primary/5")}
            >
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                {tm(key)}
                <HelpTip label={tm(key)} text={tm(`${key}Help`)} />
              </dt>
              <dd
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  value !== null && value < 0 && "text-destructive",
                )}
              >
                {formatMetric(value, format(key), f, (n) =>
                  tm("years", { value: Math.round(n * 10) / 10 }),
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <CashFlowChart outcomes={[outcome]} />

      <ScenarioDetails outcomes={[outcome]} defaultOpen />

      {/* Open to everyone during the beta; see entitlementsFor in lib/entitlements. */}
      <Sensitivity state={state} params={params} startMonth={startMonth} enabled only={[deal]} />

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t("compareTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("compareHelp")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={comparing}
            aria-controls={`${id}-compare`}
            onClick={() => setComparing((c) => !c)}
          >
            {comparing ? t("hideComparison") : t("showComparison")}
            <ChevronDown className={cn("transition-transform", comparing && "rotate-180")} />
          </Button>
        </div>
        <div id={`${id}-compare`} hidden={!comparing}>
          {comparing && (
            <Results
              output={output}
              goal={state.goal}
              onGoalChange={onGoalChange}
              onFillMissing={onFillMissing}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {params && t("parameters", { year: params.year })} {t("saveSoon")}
      </p>
      <Disclaimer />
    </>
  );
}
