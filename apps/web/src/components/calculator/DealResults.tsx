"use client";

import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { HelpTip } from "@/components/shared/HelpTip";
import {
  permanentRentalYears,
  type CalculatorOutput,
  type ScenarioOutcome,
} from "@/lib/calculator/run";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./colors";
import { formatMetric, METRICS, Results, ScenarioDetails, type MetricKey } from "./Results";
import { SaleChart } from "./SaleChart";

/** The indicators that matter most for each deal, in order. */
const HEADLINE: Record<ScenarioKind, MetricKey[]> = {
  flip: ["netProfit", "roi", "irr", "totalInvestment", "ownCapital", "peakCapital"],
  // Kept and let for good: monthly, yearly and lifetime figures, from the rent and costs.
  longTermRental: [
    "monthlyCashFlow",
    "annualCashFlow",
    "lifetimeCashFlow",
    "cashOnCash",
    "grossYield",
    "netYield",
    "paybackYears",
    "ownCapital",
  ],
  shortTermRental: [
    "monthlyCashFlow",
    "annualCashFlow",
    "grossYield",
    "netYield",
    "irr",
    "netProfit",
    "paybackYears",
    "ownCapital",
  ],
  contractAssignment: ["netProfit", "returnOnDeposit", "irr", "ownCapital"],
};

/**
 * Step 4: the chosen deals' results. With several deals, they are compared first and each has a
 * tab; with one, the comparison with the other strategies is offered on request.
 */
export function DealResults({
  deals,
  output,
  state,
  params,
  startMonth,
  onAddDeal,
  saveBar,
  photos,
  share,
}: {
  deals: ScenarioKind[];
  output: CalculatorOutput | null;
  state: CalculatorState;
  params: ParameterSet | null;
  startMonth: number;
  /** Adds a strategy to the chosen deals and opens its details. */
  onAddDeal: (kind: ScenarioKind) => void;
  /** The scenario's name and save button, shown after the comparison. */
  saveBar: React.ReactNode;
  /** The property's photos, under the save button. */
  photos: React.ReactNode;
  /** Sharing the results, after the photos. */
  share: React.ReactNode;
}) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const id = useId();
  const [comparing, setComparing] = useState(false);
  const [tab, setTab] = useState<ScenarioKind>(deals[0]!);
  const shown = deals.includes(tab) ? tab : deals[0]!;

  const outcomes = deals
    .map((d) => output?.outcomes.find((o) => o.kind === d))
    .filter((o): o is ScenarioOutcome => !!o?.result);
  if (!output || outcomes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noParameters")}</p>;
  }
  const several = deals.length > 1;
  const opportunity = output.opportunity;

  return (
    <>
      {opportunity && (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

      {several && (
        <div className="rounded-lg border p-4">
          <Results output={output} only={deals} showDetails={false} />
        </div>
      )}

      {several ? (
        <div className="space-y-5">
          <div role="tablist" aria-label={t("dealTabs")} className="flex flex-wrap gap-1 border-b">
            {deals.map((d) => (
              <button
                key={d}
                id={`${id}-tab-${d}`}
                type="button"
                role="tab"
                aria-selected={shown === d}
                aria-controls={`${id}-panel`}
                tabIndex={shown === d ? 0 : -1}
                onClick={() => setTab(d)}
                onKeyDown={(e) => {
                  const i = deals.indexOf(shown);
                  const next =
                    e.key === "ArrowRight"
                      ? deals[(i + 1) % deals.length]
                      : e.key === "ArrowLeft"
                        ? deals[(i - 1 + deals.length) % deals.length]
                        : undefined;
                  if (next) {
                    setTab(next);
                    document.getElementById(`${id}-tab-${next}`)?.focus();
                  }
                }}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  shown === d
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: SCENARIO_COLORS[d] }}
                />
                {t(`deals.${d}`)}
              </button>
            ))}
          </div>
          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${shown}`}>
            <DealOutcome
              outcome={outcomes.find((o) => o.kind === shown)!}
              rentalYears={permanentRentalYears(state)}
              sale={
                <SaleChart deal={shown} state={state} params={params} startMonth={startMonth} />
              }
            />
          </div>
        </div>
      ) : (
        <DealOutcome
          outcome={outcomes[0]!}
          rentalYears={permanentRentalYears(state)}
          sale={
            <SaleChart deal={deals[0]!} state={state} params={params} startMonth={startMonth} />
          }
        />
      )}

      {deals.length < 4 && (
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
            {comparing && <Results output={output} onFillMissing={onAddDeal} />}
          </div>
        </div>
      )}

      {/* The scenario (name and save), then sharing, after the comparison. */}
      {saveBar}
      {photos}
      {share}

      <p className="text-xs text-muted-foreground">
        {params && t("parameters", { year: params.year })}
      </p>
      <Disclaimer />
    </>
  );
}

/** One deal's headline figures, costs and warnings, and what its sale must bring in. */
function DealOutcome({
  outcome,
  rentalYears,
  sale,
}: {
  outcome: ScenarioOutcome;
  /** Years over which a long-term rental's profit and IRR are measured. */
  rentalYears: number;
  /** The break-even sale chart. */
  sale: React.ReactNode;
}) {
  const t = useTranslations("evaluate");
  const tm = useTranslations("metrics");
  const f = useFormat();
  const result = outcome.result!;
  const format = (key: MetricKey) => METRICS.find((m) => m.key === key)!.format;

  return (
    <div className="space-y-5">
      {!result.viable && <Badge variant="destructive">{t("notViable")}</Badge>}
      {outcome.kind === "longTermRental" && (
        <p className="text-xs text-muted-foreground">
          {t("permanentRentalResults", { years: rentalYears })}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HEADLINE[outcome.kind].map((key, i) => {
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
      <ScenarioDetails outcomes={[outcome]} defaultOpen />
      {sale}
    </div>
  );
}
