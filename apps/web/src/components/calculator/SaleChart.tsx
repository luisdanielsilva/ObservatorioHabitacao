"use client";

import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HelpTip } from "@/components/shared/HelpTip";
import { profitAtSale, saleAnalysis } from "@/lib/calculator/sale";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./colors";

/**
 * The lowest sale price without a loss, and how much a higher price earns: a profit curve from
 * the break-even price upwards (hovering over it shows the profit at each price).
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

  if (!analysis || analysis.points.length === 0) return null;
  const { breakEven, expected, points, years } = analysis;
  const min = points[0]!.price;
  const max = points.at(-1)!.price;
  const expectedProfit =
    params && expected !== null ? profitAtSale(deferred, params, startMonth, deal, expected) : null;
  const priceLabel = t(`priceLabel.${deal}`);

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

      <figure className="space-y-2">
        <figcaption className="text-xs text-muted-foreground">{t("chartCaption")}</figcaption>
        <div
          className="h-56"
          role="img"
          aria-label={t("chartAlt", {
            from: f.euro(min),
            to: f.euro(max),
            profitFrom: f.euro(points[0]!.profit),
            profitTo: f.euro(points.at(-1)!.profit),
          })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="price"
                type="number"
                domain={[min, max]}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                stroke="var(--muted-foreground)"
                fontSize={11}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                stroke="var(--muted-foreground)"
                fontSize={11}
                width={44}
              />
              <Tooltip
                formatter={(v) => [f.euro(Number(v)), t("profit")]}
                labelFormatter={(v) => `${priceLabel}: ${f.euro(Number(v))}`}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              {expected !== null && expected >= min && expected <= max && (
                <ReferenceLine
                  x={expected}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="2 4"
                />
              )}
              <Line
                type="monotone"
                dataKey="profit"
                stroke={SCENARIO_COLORS[deal]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {breakEven !== null && (
                <ReferenceDot
                  x={breakEven}
                  y={0}
                  r={5}
                  fill={SCENARIO_COLORS[deal]}
                  stroke="none"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </section>
  );
}
