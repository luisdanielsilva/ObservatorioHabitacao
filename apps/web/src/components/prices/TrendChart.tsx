"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/lib/useFormat";

export interface TrendPoint {
  /** Display label, e.g. "2.º trim. 2026". */
  label: string;
  value: number;
}

/**
 * A single median series over time. `summary` is read by screen readers instead of the
 * SVG, which is hidden from assistive technology.
 */
export function TrendChart({
  title,
  summary,
  points,
  color,
}: {
  title: string;
  summary: string;
  points: TrendPoint[];
  color: string;
}) {
  const f = useFormat();
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-1 text-sm font-medium">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              width={64}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => f.number(v, v < 100 ? 1 : 0)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v) => [f.euroPerM2(Number(v)), title]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
