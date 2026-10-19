"use client";

import type { ScenarioKind } from "@observatorio-habitacao/engine";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SaleBar } from "@/lib/calculator/saleChart";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { ChartTip, barPath, compactEuro, niceTicks, useWidth } from "./chartParts";

/** A price the waterfall can be drawn at, with its chip's label. */
export interface WaterfallOption {
  label: string;
  price: number;
  bars: SaleBar[];
}

const AXIS = 44;
/** Narrower columns than this and the waterfall is drawn sideways, one row per bar. */
const MIN_SLOT = 58;

/**
 * The other deals (issue #10, option C): from the sale price down to the profit, one bar per
 * flow of money, at the price chosen with the chips.
 */
export function SaleWaterfallChart({
  deal,
  options,
  initial,
}: {
  deal: ScenarioKind;
  options: WaterfallOption[];
  initial: number;
}) {
  const t = useTranslations("sale");
  const f = useFormat();
  const [chosen, setChosen] = useState(initial);
  const option = options[chosen] ?? options[0]!;

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div role="group" aria-label={t("waterfall.choose")} className="flex flex-wrap gap-1.5">
          {options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={i === chosen}
              onClick={() => setChosen(i)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                i === chosen
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {o.label} · {f.euro(o.price)}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("waterfall.caption", { price: f.euro(option.price) })}
      </p>
      <Bars deal={deal} bars={option.bars} />
    </div>
  );
}

function Bars({ deal, bars }: { deal: ScenarioKind; bars: SaleBar[] }) {
  const t = useTranslations("sale");
  const f = useFormat();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const label = (bar: SaleBar) =>
    bar.key === "price"
      ? t(`priceLabel.${deal}`)
      : bar.key === "commission" && deal === "contractAssignment"
        ? t("waterfall.bars.commissionAssignment")
        : bar.key === "profit" && bar.value < 0
          ? t("waterfall.bars.loss")
          : t(`waterfall.bars.${bar.key}`);
  const color = (bar: SaleBar) =>
    bar.key === "price"
      ? "var(--sale-price)"
      : bar.key === "profit"
        ? bar.value < 0
          ? "var(--destructive)"
          : "var(--sale-profit)"
        : "var(--sale-part-2)";
  const valueText = (bar: SaleBar, short: boolean) => {
    const text = short ? compactEuro(f, bar.value) : f.euro(bar.value).replace("-", "−");
    return bar.key !== "price" && bar.key !== "profit" && bar.value > 0 ? `+${text}` : text;
  };

  const ticks = niceTicks(
    Math.min(0, ...bars.flatMap((b) => [b.from, b.to])),
    Math.max(...bars.flatMap((b) => [b.from, b.to])),
  );
  const lo = ticks[0]!;
  const hi = ticks.at(-1)!;
  const sideways = width > 0 && (width - AXIS) / bars.length < MIN_SLOT;

  if (sideways) {
    // One row per bar: its name, the bar on a horizontal scale, and its value.
    const labelW = Math.min(132, width * 0.38);
    const valueW = 64;
    const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * (width - labelW - valueW);
    const row = 28;
    return (
      <div ref={ref} className="relative">
        <svg width={width} height={bars.length * row + 4} aria-hidden className="block">
          <line
            x1={x(0)}
            x2={x(0)}
            y1={0}
            y2={bars.length * row}
            stroke="var(--muted-foreground)"
          />
          {bars.map((bar, i) => {
            const x0 = x(Math.min(bar.from, bar.to));
            const x1 = x(Math.max(bar.from, bar.to));
            const total = bar.key === "price" || bar.key === "profit";
            return (
              <g key={bar.key}>
                <text x={0} y={i * row + 18} fontSize={12} fill="var(--muted-foreground)">
                  {label(bar)}
                </text>
                <rect
                  x={x0}
                  y={i * row + 6}
                  width={Math.max(2, x1 - x0)}
                  height={row - 12}
                  rx={3}
                  fill={color(bar)}
                />
                <text
                  x={Math.max(x0, x1) + 6}
                  y={i * row + 18}
                  fontSize={12}
                  fontWeight={total ? 600 : 400}
                  fill="var(--foreground)"
                >
                  {valueText(bar, true)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const height = 260;
  const top = 22;
  const base = 212;
  const y = (v: number) => base - ((v - lo) / (hi - lo)) * (base - top);
  const slot = (width - AXIS) / bars.length;
  const w = Math.min(54, slot * 0.66);
  const barX = (i: number) => AXIS + slot * i + (slot - w) / 2;
  // Two lines for a long name, split near its middle.
  const lines = (text: string) => {
    const words = text.split(" ");
    if (words.length < 2 || text.length * 6.2 < slot - 4) return [text];
    let cut = 1;
    while (cut < words.length - 1 && words.slice(0, cut + 1).join(" ").length <= text.length / 2)
      cut++;
    return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
  };

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden className="block overflow-visible">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={AXIS} x2={width} y1={y(v)} y2={y(v)} stroke="var(--border)" />
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
          <line x1={AXIS} x2={width} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" />
          {bars.map((bar, i) => {
            const total = bar.key === "price" || bar.key === "profit";
            const next = bars[i + 1];
            return (
              <g key={bar.key} opacity={active === null || active === i ? 1 : 0.7}>
                <path
                  d={barPath(barX(i), y(bar.from), w, y(bar.to), bar.to >= bar.from)}
                  fill={color(bar)}
                />
                {next && next.key !== "profit" && (
                  <line
                    x1={barX(i) + w}
                    x2={barX(i + 1)}
                    y1={y(bar.to)}
                    y2={y(bar.to)}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="2 3"
                  />
                )}
                <text
                  x={barX(i) + w / 2}
                  y={bar.to >= bar.from ? y(bar.to) - 6 : y(bar.to) + 14}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={total ? 600 : 400}
                  fill="var(--foreground)"
                >
                  {valueText(bar, true)}
                </text>
                {lines(label(bar)).map((line, l) => (
                  <text
                    key={l}
                    x={barX(i) + w / 2}
                    y={base + 18 + l * 13}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--muted-foreground)"
                  >
                    {line}
                  </text>
                ))}
                <rect
                  x={AXIS + slot * i}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(active === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && bars[active] && (
        <ChartTip
          x={Math.min(Math.max(barX(active) + w / 2, 80), width - 80)}
          y={y(Math.max(bars[active]!.from, bars[active]!.to))}
        >
          <span className="font-semibold">{label(bars[active]!)}</span>:{" "}
          {valueText(bars[active]!, false)}
        </ChartTip>
      )}
    </div>
  );
}
