/**
 * Seasons used to enter short-term rental values (WBS 5.3.4):
 * high June–September, mid April, May and October, low November–March.
 */
export interface Seasonal<T> {
  high: T;
  mid: T;
  low: T;
}

const SEASON_BY_MONTH: (keyof Seasonal<unknown>)[] = [
  "low", // Jan
  "low",
  "low",
  "mid", // Apr
  "mid",
  "high", // Jun
  "high",
  "high",
  "high", // Sep
  "mid",
  "low",
  "low", // Dec
];

/** Expands seasonal values into the 12 calendar-month values the engine expects. */
export function seasonsToMonths<T>(values: Seasonal<T>): T[] {
  return SEASON_BY_MONTH.map((season) => values[season]);
}
