"use client";

import type { Goal, ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import { AlertTriangle, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { HelpTip } from "@/components/shared/HelpTip";
import type { CalculatorOutput, ScenarioOutcome } from "@/lib/calculator/run";
import type { Formatter } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { CashFlowChart, SCENARIO_COLORS } from "./CashFlowChart";

const GOALS: Goal[] = ["profit", "irr", "yield", "capital"];

type MetricKey =
  | "totalInvestment"
  | "ownCapital"
  | "peakCapital"
  | "netProfit"
  | "roi"
  | "irr"
  | "grossYield"
  | "netYield"
  | "monthlyCashFlow"
  | "paybackYears"
  | "returnOnDeposit";

const METRICS: { key: MetricKey; format: "euro" | "percent" | "years" }[] = [
  { key: "netProfit", format: "euro" },
  { key: "irr", format: "percent" },
  { key: "roi", format: "percent" },
  { key: "monthlyCashFlow", format: "euro" },
  { key: "grossYield", format: "percent" },
  { key: "netYield", format: "percent" },
  { key: "paybackYears", format: "years" },
  { key: "returnOnDeposit", format: "percent" },
  { key: "totalInvestment", format: "euro" },
  { key: "ownCapital", format: "euro" },
  { key: "peakCapital", format: "euro" },
];

export function Results({
  output,
  goal,
  onGoalChange,
  paramsYear,
}: {
  output: CalculatorOutput | null;
  goal: Goal;
  onGoalChange: (goal: Goal) => void;
  paramsYear: number | null;
}) {
  const t = useTranslations("evaluate");
  const tm = useTranslations("metrics");
  const ts = useTranslations("scenarios");
  const f = useFormat();
  const id = useId();

  if (!output) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("noParameters")}</p>
      </section>
    );
  }

  const best = output.comparison.best;
  const value = (r: ScenarioResult, key: MetricKey, format: "euro" | "percent" | "years") =>
    formatMetric(r[key], format, f, (n) => tm("years", { value: Math.round(n * 10) / 10 }));

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t("stepResults")}
        </h2>
        <div
          role="radiogroup"
          aria-label={t("goal")}
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={goal === g}
              onClick={() => onGoalChange(g)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                goal === g
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`goals.${g}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Contained horizontal scroll on small screens; the page itself never scrolls sideways. */}
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{t("resultsTitle")}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-40 pb-2 text-left text-xs font-medium text-muted-foreground"
              >
                {t("metric")}
              </th>
              {output.outcomes.map((o) => (
                <th
                  key={o.kind}
                  scope="col"
                  className={cn(
                    "rounded-t-lg px-2 pt-2 pb-2 text-left align-bottom",
                    best === o.kind && "bg-primary/10",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: SCENARIO_COLORS[o.kind] }}
                    />
                    {ts(`${o.kind}Short`)}
                  </span>
                  {best === o.kind && (
                    <Badge className="mt-1 gap-1">
                      <Trophy className="size-3" /> {t("best")}
                    </Badge>
                  )}
                  {o.result && !o.result.viable && (
                    <Badge variant="destructive" className="mt-1">
                      {t("notViable")}
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.outcomes.some((o) => o.missing) && (
              <tr>
                <th scope="row" className="sr-only">
                  {t("missing", { fields: "" })}
                </th>
                {output.outcomes.map((o) => (
                  <td
                    key={o.kind}
                    className={cn(
                      "px-2 pb-2 align-top text-xs text-muted-foreground",
                      best === o.kind && "bg-primary/10",
                    )}
                  >
                    {o.missing &&
                      t("missing", {
                        fields: o.missing.map((m) => t(`missingFields.${m}`)).join(", "),
                      })}
                  </td>
                ))}
              </tr>
            )}
            {METRICS.map(({ key, format }) => (
              <tr key={key}>
                <th scope="row" className="border-t py-2 pr-2 text-left font-normal">
                  <span className="flex items-center gap-1">
                    {tm(key)}
                    <HelpTip label={tm(key)} text={tm(`${key}Help`)} />
                  </span>
                </th>
                {output.outcomes.map((o) => (
                  <td
                    key={o.kind}
                    className={cn(
                      "border-t px-2 py-2 tabular-nums",
                      best === o.kind && "bg-primary/10 font-medium",
                      o.result && isNegative(o.result[key]) && "text-destructive",
                    )}
                  >
                    {o.result ? value(o.result, key, format) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CashFlowChart outcomes={output.outcomes} />

      <ScenarioDetails outcomes={output.outcomes} />

      <p className="text-xs text-muted-foreground">
        {paramsYear && t("parameters", { year: paramsYear })} {t("saveSoon")}
      </p>
      <Disclaimer />
    </section>
  );
}

function isNegative(v: number | null) {
  return v !== null && v < 0;
}

function formatMetric(
  v: number | null,
  format: "euro" | "percent" | "years",
  f: Formatter,
  years: (n: number) => string,
): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (format === "euro") return f.euro(v);
  if (format === "percent") return f.percent(v);
  return years(v);
}

function ScenarioDetails({ outcomes }: { outcomes: ScenarioOutcome[] }) {
  const t = useTranslations("evaluate");
  const ta = useTranslations("acquisition");
  const tw = useTranslations("warnings");
  const ts = useTranslations("scenarios");
  const tm = useTranslations("metrics");
  const f = useFormat();

  const withResults = outcomes.filter(
    (o): o is ScenarioOutcome & { result: ScenarioResult } => !!o.result,
  );
  if (withResults.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t("details")}</h3>
      {withResults.map(({ kind, result }) => (
        <details key={kind} className="group rounded-lg border px-4 py-2 open:pb-4">
          <summary className="flex cursor-pointer items-center gap-2 py-1 text-sm font-medium">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: SCENARIO_COLORS[kind] }}
            />
            {ts(kind as ScenarioKind)}
            {result.warnings.length > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="size-3.5" aria-hidden /> {result.warnings.length}
              </span>
            )}
          </summary>
          {result.acquisition && (
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="col-span-2 flex items-center gap-1 font-medium">
                {tm("acquisitionCosts")}
                <HelpTip label={tm("acquisitionCosts")} text={tm("acquisitionCostsHelp")} />
              </dt>
              {(
                [
                  "imt",
                  "stampDutyPurchase",
                  "stampDutyLoan",
                  "deedAndRegistry",
                  "bankFees",
                ] as const
              )
                .filter((k) => result.acquisition![k] > 0)
                .map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{ta(k)}</dt>
                    <dd className="text-right tabular-nums">{f.euro(result.acquisition![k])}</dd>
                  </div>
                ))}
              <dt className="font-medium">{ta("total")}</dt>
              <dd className="text-right font-medium tabular-nums">
                {f.euro(result.acquisition.total)}
              </dd>
            </dl>
          )}
          {result.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium">{t("warningsTitle")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.warnings.map((w) => (
                  <li key={w}>{tw(w)}</li>
                ))}
              </ul>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
