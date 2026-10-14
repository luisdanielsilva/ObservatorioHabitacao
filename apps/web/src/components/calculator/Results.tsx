"use client";

import type { ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/HelpTip";
import type { CalculatorOutput, ScenarioOutcome } from "@/lib/calculator/run";
import type { Formatter } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { COST_ITEMS, ownershipCosts } from "@/lib/calculator/costs";
import { describeGainTax } from "@/lib/calculator/gainTax";
import { SCENARIO_COLORS } from "./colors";

export type MetricKey =
  | "totalInvestment"
  | "ownCapital"
  | "peakCapital"
  | "netProfit"
  | "roi"
  | "irr"
  | "grossYield"
  | "netYield"
  | "monthlyCashFlow"
  | "annualCashFlow"
  | "lifetimeCashFlow"
  | "cashOnCash"
  | "paybackYears"
  | "returnOnDeposit";

export const METRICS: { key: MetricKey; format: "euro" | "percent" | "years" }[] = [
  { key: "netProfit", format: "euro" },
  { key: "irr", format: "percent" },
  { key: "roi", format: "percent" },
  { key: "monthlyCashFlow", format: "euro" },
  { key: "annualCashFlow", format: "euro" },
  { key: "lifetimeCashFlow", format: "euro" },
  { key: "cashOnCash", format: "percent" },
  { key: "grossYield", format: "percent" },
  { key: "netYield", format: "percent" },
  { key: "paybackYears", format: "years" },
  { key: "returnOnDeposit", format: "percent" },
  { key: "totalInvestment", format: "euro" },
  { key: "ownCapital", format: "euro" },
  { key: "peakCapital", format: "euro" },
];

/**
 * The strategies side by side, with the indicators that apply to them. No strategy is ranked
 * or recommended: the user compares and decides.
 */
export function Results({
  output: fullOutput,
  onFillMissing,
  only,
  showDetails = true,
}: {
  output: CalculatorOutput | null;
  /** Costs and warnings per strategy; off where each deal shows its own. */
  showDetails?: boolean;
  /** Limits the comparison to these strategies. */
  only?: ScenarioKind[];
  /** Opens the details of a strategy that still needs inputs (not on shared pages). */
  onFillMissing?: (kind: ScenarioKind) => void;
}) {
  const t = useTranslations("evaluate");
  const tm = useTranslations("metrics");
  const ts = useTranslations("scenarios");
  const f = useFormat();
  const id = useId();
  const output =
    fullOutput && only
      ? { ...fullOutput, outcomes: fullOutput.outcomes.filter((o) => only.includes(o.kind)) }
      : fullOutput;

  if (!output) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("noParameters")}</p>
      </section>
    );
  }

  // Only the indicators that apply to at least one of the strategies shown.
  const metrics = METRICS.filter(({ key }) =>
    output.outcomes.some((o) => o.result && o.result[key] !== null),
  );
  const value = (r: ScenarioResult, key: MetricKey, format: "euro" | "percent" | "years") =>
    formatMetric(r[key], format, f, (n) => tm("years", { value: Math.round(n * 10) / 10 }));

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-5">
      <h3 id={`${id}-title`} className="font-semibold">
        {t("resultsTitle")}
      </h3>

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
                <th key={o.kind} scope="col" className="px-2 pt-2 pb-2 text-left align-bottom">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: SCENARIO_COLORS[o.kind] }}
                    />
                    {ts(`${o.kind}Short`)}
                  </span>
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
                  <td key={o.kind} className="px-2 pb-2 align-top text-xs text-muted-foreground">
                    {o.missing && (
                      <>
                        {t("missing", {
                          fields: o.missing.map((m) => t(`missingFields.${m}`)).join(", "),
                        })}
                        {onFillMissing && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            onClick={() => onFillMissing(o.kind)}
                          >
                            {t("fillMissing")}
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {metrics.map(({ key, format }) => (
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

      {showDetails && <ScenarioDetails outcomes={output.outcomes} />}
    </section>
  );
}

function isNegative(v: number | null) {
  return v !== null && v < 0;
}

export function formatMetric(
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

/** Acquisition costs, the tax on the sale and warnings per strategy, in collapsible panels. */
export function ScenarioDetails({
  outcomes,
  defaultOpen = false,
}: {
  outcomes: ScenarioOutcome[];
  defaultOpen?: boolean;
}) {
  const t = useTranslations("evaluate");
  const ta = useTranslations("acquisition");
  const tw = useTranslations("warnings");
  const ts = useTranslations("scenarios");
  const tm = useTranslations("metrics");
  const tg = useTranslations("gainTax");
  const f = useFormat();

  const withResults = outcomes.filter(
    (o): o is ScenarioOutcome & { result: ScenarioResult } => !!o.result,
  );
  if (withResults.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t("details")}</h3>
      {withResults.map(({ kind, result }) => {
        const costs = ownershipCosts(kind, result);
        const gain = result.gainTax && describeGainTax(result.gainTax, tg, f);
        return (
          <details
            key={kind}
            open={defaultOpen || undefined}
            className="group rounded-lg border px-4 py-2 open:pb-4"
          >
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
                    "valuationFee",
                    "processingFee",
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
            {costs && (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="col-span-2 flex items-center gap-1 font-medium">
                  {costs.months === null
                    ? t("annualCosts")
                    : t("holdingCosts", { months: costs.months })}
                  <HelpTip
                    label={t("annualCosts")}
                    text={costs.months === null ? t("annualCostsHelp") : t("holdingCostsHelp")}
                  />
                </dt>
                {COST_ITEMS.filter((k) => costs.items[k] !== undefined).map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{t(`annualCostItems.${k}`)}</dt>
                    <dd className="text-right tabular-nums">{f.euro(costs.items[k]!)}</dd>
                  </div>
                ))}
                <dt className="font-medium">{ta("total")}</dt>
                <dd className="text-right font-medium tabular-nums">{f.euro(costs.total)}</dd>
              </dl>
            )}
            {gain && (
              <div className="mt-3 space-y-1.5">
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt className="col-span-2 flex items-center gap-1 font-medium">
                    {tg("title")}
                    <HelpTip label={tg("title")} text={tg("help")} />
                  </dt>
                  <dd className="col-span-2 text-xs text-muted-foreground">{gain.price}</dd>
                  {gain.rows.map((row) => (
                    <div key={row.label} className="contents">
                      <dt className={row.total ? "font-medium" : "text-muted-foreground"}>
                        {row.label}
                      </dt>
                      <dd className={cn("text-right tabular-nums", row.total && "font-medium")}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {gain.notes.map((note) => (
                  <p key={note} className="text-xs text-muted-foreground">
                    {note}
                  </p>
                ))}
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium">{t("warningsTitle")}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {result.warnings.map((w) => (
                    <li key={w}>{tw(w)}</li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
