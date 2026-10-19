"use client";

import type { ParameterSet, ScenarioKind } from "@observatorio-habitacao/engine";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo } from "react";
import { HelpTip } from "@/components/shared/HelpTip";
import { nearStep, profitAtSale, saleAnalysis } from "@/lib/calculator/sale";
import {
  breakdownAtSale,
  priceSplit,
  saleWaterfall,
  type PriceSplit,
} from "@/lib/calculator/saleChart";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { SaleSplitChart } from "./SaleSplitChart";
import { SaleWaterfallChart, type WaterfallOption } from "./SaleWaterfallChart";

/**
 * The lowest sale price without a loss, and how much a higher price earns: the net profit in
 * 5 % steps above that price. Charted (issue #10) for a resale as stacked columns, where each
 * step's price goes; for the other deals as a waterfall from a chosen price to the profit.
 */
export function SaleChart({
  deal,
  state,
  params,
  startMonth,
}: {
  deal: ScenarioKind;
  state: CalculatorState;
  params: ParameterSet | null;
  startMonth: number;
}) {
  const t = useTranslations("sale");
  const f = useFormat();
  const id = useId();
  const deferred = useDeferredValue(state);
  const analysis = useMemo(
    () => (params ? saleAnalysis(deferred, params, startMonth, deal) : null),
    [deferred, params, startMonth, deal],
  );

  // Resale: where each step's price goes (stacked columns); the other deals, or a resale whose
  // parts cannot be stacked: a waterfall from the sale price to the profit, at a chosen price.
  const chart = useMemo(() => {
    if (!params || !analysis) return null;
    const at = (price: number) => breakdownAtSale(deferred, params, startMonth, deal, price);
    if (deal === "flip" && analysis.steps.length > 0) {
      const splits = analysis.steps.map((s) => {
        const b = at(s.price);
        return b ? priceSplit(s.price, b) : null;
      });
      if (splits.every((split) => split !== null)) {
        return { kind: "split" as const, splits: splits as PriceSplit[] };
      }
    }
    const options: WaterfallOption[] = [];
    analysis.steps.forEach((s, i) => {
      const b = at(s.price);
      if (!b) return;
      const label =
        i > 0
          ? `+${f.number(s.change * 100)}%`
          : t(analysis.stepsFrom === "breakEven" ? "waterfall.breakEven" : "waterfall.entered");
      options.push({ label, price: s.price, bars: saleWaterfall(s.price, b) });
    });
    // The price entered, when the steps don't start from it: shown first.
    let initial = 0;
    const { expected } = analysis;
    if (expected !== null && analysis.stepsFrom !== "expected") {
      const b = at(expected);
      if (b) {
        options.push({
          label: t("waterfall.entered"),
          price: expected,
          bars: saleWaterfall(expected, b),
        });
        initial = options.length - 1;
      }
    }
    return options.length > 0 ? { kind: "waterfall" as const, options, initial } : null;
  }, [analysis, deferred, params, startMonth, deal, f, t]);

  if (!analysis) return null;
  const { breakEven, expected, steps, stepsFrom, years } = analysis;
  const expectedProfit =
    params && expected !== null ? profitAtSale(deferred, params, startMonth, deal, expected) : null;
  const near = nearStep(steps, expected);

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-1">
        <h3 id={`${id}-title`} className="font-semibold">
          {t("title")}
        </h3>
        <HelpTip label={t("title")} text={t(`help.${deal}`, { years: years ?? 0 })} />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
          <dt className="text-xs text-muted-foreground">{t(`breakEven.${deal}`)}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {breakEven !== null ? f.euro(breakEven) : t("noBreakEven")}
          </dd>
        </div>
        {expected !== null && (
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">
              {t("atExpected", { price: f.euro(expected) })}
            </dt>
            <dd
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                (expectedProfit ?? 0) < 0 && "text-destructive",
              )}
            >
              {expectedProfit === null ? "—" : f.euro(expectedProfit)}
            </dd>
          </div>
        )}
      </dl>

      {stepsFrom && (
        // The steps as a list for screen readers; the chart below draws them.
        <div className="sr-only">
          <p id={`${id}-steps`}>{t(`stepsCaption.${stepsFrom}`)}</p>
          <ol aria-labelledby={`${id}-steps`}>
            {steps.map((step, i) => (
              <li key={step.change}>
                {step.change === 0 ? "0%" : `+${f.number(step.change * 100)}%`} {f.euro(step.price)}
                {i === near && ` (${t("nearExpected")})`}: {t("netProfit")} {f.euro(step.profit)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {chart?.kind === "split" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("split.caption")}</p>
          <SaleSplitChart steps={steps} splits={chart.splits} near={near} />
        </div>
      )}
      {chart?.kind === "waterfall" && (
        <SaleWaterfallChart
          key={deal}
          deal={deal}
          options={chart.options}
          initial={chart.initial}
        />
      )}
    </section>
  );
}
