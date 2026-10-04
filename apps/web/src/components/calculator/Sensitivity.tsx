"use client";

import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HelpTip } from "@/components/shared/HelpTip";
import { SCENARIO_KINDS } from "@/lib/calculator/run";
import {
  SENSITIVITY_RANGES,
  sensitivityDeltas,
  sensitivityTable,
  type SensitivityMetric,
  type SensitivityVariable,
} from "@/lib/calculator/sensitivity";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./CashFlowChart";

const VARIABLES: SensitivityVariable[] = ["price", "rent", "occupancy", "interest"];
const METRICS: SensitivityMetric[] = ["netProfit", "irr", "netYield", "monthlyCashFlow"];

/** How results move when one input changes (WBS 5.3.7). */
export function Sensitivity({
  state,
  params,
  startMonth,
  enabled,
  only,
}: {
  state: CalculatorState;
  params: ParameterSet | null;
  startMonth: number;
  /** From the user's plan entitlements; open to everyone during the beta. */
  enabled: boolean;
  /** Limits the table and chart to these strategies. */
  only?: ScenarioKind[];
}) {
  const t = useTranslations("sensitivity");
  const tm = useTranslations("metrics");
  const ts = useTranslations("scenarios");
  const f = useFormat();
  const id = useId();
  const [variable, setVariable] = useState<SensitivityVariable>("price");
  const [metric, setMetric] = useState<SensitivityMetric>("netProfit");
  const [delta, setDelta] = useState(0);
  const deferredState = useDeferredValue(state);
  const deferredDelta = useDeferredValue(delta);

  const range = SENSITIVITY_RANGES[variable];
  const curve = useMemo(() => {
    if (!params || !enabled) return [];
    try {
      return sensitivityTable(
        deferredState,
        params,
        startMonth,
        variable,
        metric,
        sensitivityDeltas(variable),
      );
    } catch {
      return [];
    }
  }, [deferredState, params, startMonth, variable, metric, enabled]);

  const [base, shifted] = useMemo(() => {
    if (!params || !enabled) return [undefined, undefined];
    try {
      return sensitivityTable(deferredState, params, startMonth, variable, metric, [
        0,
        deferredDelta,
      ]);
    } catch {
      return [undefined, undefined];
    }
  }, [deferredState, params, startMonth, variable, metric, deferredDelta, enabled]);

  const kinds = SCENARIO_KINDS.filter(
    (k) => (!only || only.includes(k)) && base?.[k] !== undefined && base[k] !== null,
  );
  const formatMetric = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v)
      ? "—"
      : metric === "netProfit" || metric === "monthlyCashFlow"
        ? f.euro(v)
        : f.percent(v);
  const formatChange = (from: number, to: number) =>
    metric === "netProfit" || metric === "monthlyCashFlow"
      ? `${to - from >= 0 ? "+" : "−"}${f.euro(Math.abs(to - from))}`
      : `${to - from >= 0 ? "+" : "−"}${f.number(Math.abs(to - from) * 100, 1)} p.p.`;
  const formatDelta = (d: number) =>
    range.unit === "percent"
      ? f.signedPercent(d, 0)
      : `${d > 0 ? "+" : d < 0 ? "−" : ""}${f.number(Math.abs(d) * 100, 2)} p.p.`;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-1">
        <h3 id={`${id}-title`} className="font-semibold">
          {t("title")}
        </h3>
        <HelpTip label={t("title")} text={t("intro")} />
      </div>

      {!enabled ? (
        <p className="text-sm text-muted-foreground">{t("premium")}</p>
      ) : kinds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div
              role="radiogroup"
              aria-label={t("variable")}
              className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
            >
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={variable === v}
                  onClick={() => {
                    setVariable(v);
                    setDelta(0);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    variable === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`variables.${v}`)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("metric")}</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as SensitivityMetric)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30 [&>option]:bg-popover"
              >
                {METRICS.map((m) => (
                  <option key={m} value={m}>
                    {tm(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={`${id}-slider`}>{t(`variableLong.${variable}`)}</label>
              <output htmlFor={`${id}-slider`} className="font-semibold tabular-nums">
                {formatDelta(delta)}
              </output>
            </div>
            <input
              id={`${id}-slider`}
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              aria-valuetext={formatDelta(delta)}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDelta(range.min)}</span>
              <span>{formatDelta(range.max)}</span>
            </div>
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 text-left font-medium">
                  {t("scenario")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("base")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {formatDelta(delta)}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("change")}
                </th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => {
                const from = base?.[k] ?? null;
                const to = shifted?.[k] ?? null;
                return (
                  <tr key={k} className="border-t">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ background: SCENARIO_COLORS[k] }}
                        />
                        {ts(`${k}Short`)}
                      </span>
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{formatMetric(from)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">
                      {formatMetric(to)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right tabular-nums",
                        from !== null && to !== null && to < from && "text-destructive",
                        from !== null && to !== null && to > from && "text-positive",
                      )}
                    >
                      {from !== null && to !== null ? formatChange(from, to) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <figure className="space-y-1">
            <figcaption className="text-xs text-muted-foreground">{t("chartTitle")}</figcaption>
            <div
              className="h-48"
              role="img"
              aria-label={`${t("chartTitle")}: ${kinds
                .map(
                  (k) =>
                    `${ts(k as ScenarioKind)} ${formatMetric(curve[0]?.[k])} → ${formatMetric(curve.at(-1)?.[k])}`,
                )
                .join("; ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="delta"
                    type="number"
                    domain={[range.min, range.max]}
                    tickFormatter={(d: number) => formatDelta(d)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    width={64}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      metric === "netProfit" || metric === "monthlyCashFlow"
                        ? Math.abs(v) >= 1000
                          ? `${f.number(v / 1000)}k`
                          : f.number(v)
                        : f.percent(v, 0)
                    }
                  />
                  <ReferenceLine x={delta} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                    labelFormatter={(d) => formatDelta(Number(d))}
                    formatter={(v, name) => [
                      formatMetric(Number(v)),
                      ts(`${name as ScenarioKind}Short`),
                    ]}
                  />
                  {kinds.map((k) => (
                    <Line
                      key={k}
                      dataKey={k}
                      stroke={SCENARIO_COLORS[k]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
        </>
      )}
    </section>
  );
}
