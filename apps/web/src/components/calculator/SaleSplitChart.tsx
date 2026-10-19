"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SaleStep } from "@/lib/calculator/sale";
import type { PriceSplit } from "@/lib/calculator/saleChart";
import { useFormat } from "@/lib/useFormat";
import { ChartTip, barPath, compactEuro, niceTicks, useWidth } from "./chartParts";

const PARTS = [
  ["loan", "var(--sale-part-1)"],
  ["ownMoney", "var(--sale-part-2)"],
  ["costs", "var(--sale-part-3)"],
  ["profit", "var(--sale-profit)"],
] as const;

const HEIGHT = 250;
/** Under 1 € is no profit: at the lowest price the calculation lands a few cents above zero. */
const shown = (v: number) => (Math.abs(v) < 1 ? 0 : v);
const TOP = 22;
const BASE = 200;
const AXIS = 40;
/** Room for the parts' names beside the last column, on wide screens. */
const SIDE_LABELS = 110;

/**
 * Resale (issue #10, option B): each step's sale price as a column, split into the loan paid
 * off, the money put in coming back, the commission and IRS, and the profit on top.
 */
export function SaleSplitChart({
  steps,
  splits,
  near,
}: {
  steps: SaleStep[];
  splits: PriceSplit[];
  near: number;
}) {
  const t = useTranslations("sale");
  const f = useFormat();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const ticks = niceTicks(0, Math.max(...splits.map((s) => s.price)));
  const max = ticks.at(-1)!;
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const sideLabels = width >= 480;
  const plotEnd = width - (sideLabels ? SIDE_LABELS : 4);
  const slot = (plotEnd - AXIS) / splits.length;
  const w = Math.min(56, slot * 0.62);
  const columnX = (i: number) => AXIS + slot * i + (slot - w) / 2;
  const last = splits.at(-1)!;
  const stepLabel = (s: SaleStep) => (s.change === 0 ? "0%" : `+${f.number(s.change * 100)}%`);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {PARTS.map(([key, color]) => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px]" style={{ background: color }} />
            {t(`split.${key}`)}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={AXIS} x2={plotEnd} y1={y(v)} y2={y(v)} stroke="var(--border)" />
                <text
                  x={AXIS - 6}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--muted-foreground)"
                >
                  {v === 0 ? "0" : compactEuro(f, v)}
                </text>
              </g>
            ))}
            {splits.map((split, i) => {
              let below = 0;
              const parts = PARTS.filter(([key]) => split[key] >= 1);
              return (
                <g key={steps[i]!.change} opacity={active === null || active === i ? 1 : 0.7}>
                  {parts.map(([key, color], p) => {
                    // 2 px of the surface between the parts.
                    const y0 = y(below) - (below > 0 ? 1 : 0);
                    below += split[key];
                    const y1 = y(below) + (p < parts.length - 1 ? 1 : 0);
                    return (
                      <path
                        key={key}
                        d={barPath(columnX(i), y0, w, y1, p === parts.length - 1)}
                        fill={color}
                      />
                    );
                  })}
                  <text
                    x={columnX(i) + w / 2}
                    y={y(split.price) - 6}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--foreground)"
                  >
                    {shown(split.profit) === 0 ? "0" : `+${compactEuro(f, split.profit)}`}
                  </text>
                  <text
                    x={columnX(i) + w / 2}
                    y={BASE + 17}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={i === near ? 600 : 400}
                    fill={i === near ? "var(--foreground)" : "var(--muted-foreground)"}
                  >
                    {stepLabel(steps[i]!)}
                  </text>
                  <text
                    x={columnX(i) + w / 2}
                    y={BASE + 33}
                    textAnchor="middle"
                    fontSize={width < 400 ? 9.5 : 11}
                    fill="var(--muted-foreground)"
                  >
                    {f.euro(split.price)}
                  </text>
                  <rect
                    x={AXIS + slot * i}
                    y={0}
                    width={slot}
                    height={HEIGHT}
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(active === i ? null : i)}
                  />
                </g>
              );
            })}
            {sideLabels &&
              PARTS.map(([key], p) => {
                const below = PARTS.slice(0, p).reduce((sum, [k]) => sum + last[k], 0);
                if (last[key] < 1) return null;
                return (
                  <text
                    key={key}
                    x={columnX(splits.length - 1) + w + 10}
                    y={y(below + last[key] / 2) + 4}
                    fontSize={11.5}
                    fontWeight={key === "profit" ? 600 : 400}
                    fill={key === "profit" ? "var(--foreground)" : "var(--muted-foreground)"}
                  >
                    {t(`split.short.${key}`)}
                  </text>
                );
              })}
            <line x1={AXIS} x2={plotEnd} y1={BASE} y2={BASE} stroke="var(--muted-foreground)" />
          </svg>
        )}
        {active !== null && width > 0 && (
          <ChartTip
            x={Math.min(Math.max(columnX(active) + w / 2, 100), width - 100)}
            y={y(splits[active]!.price)}
          >
            <p className="font-semibold">
              {stepLabel(steps[active]!)} · {f.euro(splits[active]!.price)}
              {active === near && ` · ${t("nearExpected")}`}
            </p>
            {PARTS.map(([key]) => (
              <p key={key} className={key === "profit" ? "font-semibold" : undefined}>
                {t(`split.${key}`)}: {f.euro(shown(splits[active]![key]))}
              </p>
            ))}
          </ChartTip>
        )}
      </div>
    </div>
  );
}
