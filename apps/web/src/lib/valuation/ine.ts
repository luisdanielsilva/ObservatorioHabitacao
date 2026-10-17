import type { IneBase } from "./estimate";

/** The INE base from a market reference (the API's or the database's). */
export function ineBase(
  ref: {
    value: number;
    period: string;
    areaName: string;
    level: string;
    yearOnYear: number | null;
  } | null,
): IneBase | null {
  return ref
    ? {
        value: ref.value,
        period: ref.period,
        areaName: ref.areaName,
        level: ref.level,
        yearOnYear: ref.yearOnYear,
      }
    : null;
}
