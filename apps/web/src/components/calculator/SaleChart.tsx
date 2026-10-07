"use client";

import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo } from "react";
import { HelpTip } from "@/components/shared/HelpTip";
import { nearStep, profitAtSale, saleAnalysis } from "@/lib/calculator/sale";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./colors";

/**
 * The lowest sale price without a loss, and how much a higher price earns: the net profit in
 * 5 % steps above that price, as bars.
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

  if (!analysis) return null;
  const { breakEven, expected, steps, stepsFrom, years } = analysis;
  const expectedProfit =
    params && expected !== null ? profitAtSale(deferred, params, startMonth, deal, expected) : null;
  const maxProfit = Math.max(1, ...steps.map((s) => s.profit));
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
        <div className="space-y-2">
          <p id={`${id}-steps`} className="text-xs text-muted-foreground">
            {t(`stepsCaption.${stepsFrom}`)}
          </p>
          <ol aria-labelledby={`${id}-steps`} className="space-y-1.5 text-sm">
            {steps.map((step, i) => (
              <li
                key={step.change}
                // Phones: change, price and profit on a line, the bar under them.
                className={cn(
                  "grid grid-cols-[3rem_1fr_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[3rem_9rem_1fr_7rem]",
                  i === near && "font-semibold",
                )}
              >
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {step.change === 0 ? "0%" : `+${f.number(step.change * 100)}%`}
                </span>
                <span className="tabular-nums">
                  {f.euro(step.price)}
                  {i === near && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {t("nearExpected")}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="order-last col-span-3 h-2 sm:order-none sm:col-span-1 sm:h-4"
                >
                  <span
                    className="block h-full min-w-0.5 rounded-sm"
                    style={{
                      width: `${(Math.max(0, step.profit) / maxProfit) * 100}%`,
                      background: SCENARIO_COLORS[deal],
                    }}
                  />
                </span>
                <span
                  className={cn("text-right tabular-nums", step.profit < 0 && "text-destructive")}
                >
                  <span className="sr-only">{t("netProfit")}: </span>
                  {f.euro(step.profit)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
