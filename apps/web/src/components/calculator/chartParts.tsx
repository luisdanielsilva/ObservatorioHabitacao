"use client";

import { useCallback, useRef, useState } from "react";
import type { Formatter } from "@/lib/format";

/**
 * The width of the element given `ref`, followed as it changes; 0 until it is measured. A
 * callback ref, so it follows a new element when the chart swaps its layout.
 */
export function useWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.current.observe(el);
  }, []);
  return [ref, width] as const;
}

/** Round gridline values from `min` (≤ 0) to `max`, about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(1, max - Math.min(0, min));
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.floor(Math.min(0, min) / step) * step; v <= max + step * 0.999; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

/** 49k, 4,8k or 485, with a real minus sign: short enough for a bar's label. */
export function compactEuro(f: Formatter, value: number): string {
  const text =
    Math.abs(value) >= 1000
      ? `${f.number(value / 1000, Math.abs(value) >= 10_000 ? 0 : 1)}k`
      : f.number(value);
  return text.replace("-", "−");
}

/** A bar with 4 px rounded ends away from the baseline (`up`: the top is rounded). */
export function barPath(x: number, y0: number, w: number, y1: number, up: boolean): string {
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const r = Math.min(4, bottom - top, w / 2);
  return up
    ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
    : `M${x},${top}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${x + w - r}Q${x + w},${bottom} ${x + w},${bottom - r}V${top}Z`;
}

/** A value's tooltip over the chart, centred above `x`, `y` (in the chart's pixels). */
export function ChartTip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background tabular-nums shadow-md"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}
