"use client";

import type { ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScenarioOutcome } from "@/lib/calculator/run";
import { useFormat } from "@/lib/useFormat";

export const SCENARIO_COLORS: Record<ScenarioKind, string> = {
  flip: "var(--chart-2)",
  longTermRental: "var(--chart-1)",
  shortTermRental: "var(--chart-3)",
  contractAssignment: "var(--chart-4)",
};

/** Cumulative cash position of each scenario, month by month. */
export function CashFlowChart({ outcomes }: { outcomes: ScenarioOutcome[] }) {
  const t = useTranslations("evaluate");
  const ts = useTranslations("scenarios");
  const f = useFormat();

  const series = outcomes.filter((o) => o.result);
  const data = useMemo(() => {
    const length = Math.max(0, ...series.map((o) => o.result!.months.length));
    return Array.from({ length }, (_, month) => {
      const row: Record<string, number> = { month };
      for (const o of series) {
        const line = o.result!.months[month];
        if (line) row[o.kind] = Math.round(line.cumulative);
      }
      return row;
    });
  }, [series]);

  if (series.length === 0) return null;

  // Text alternative: the final balance of each scenario.
  const summary = series
    .map((o) => `${ts(o.kind)}: ${f.euro(o.result!.months.at(-1)!.cumulative)}`)
    .join("; ");

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold">
        {t("chartTitle")}
        <span className="block text-xs font-normal text-muted-foreground">{t("chartHelp")}</span>
      </figcaption>
      <div className="h-64" role="img" aria-label={`${t("chartTitle")}. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => `${f.number(v / 1000)}k`}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(m) => t("chartMonth", { month: Number(m) })}
              formatter={(v, name) => [f.euro(Number(v)), ts(name as ScenarioKind)]}
            />
            <Legend formatter={(name) => ts(`${name as ScenarioKind}Short`)} />
            {series.map((o) => (
              <Line
                key={o.kind}
                dataKey={o.kind}
                stroke={SCENARIO_COLORS[o.kind]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
