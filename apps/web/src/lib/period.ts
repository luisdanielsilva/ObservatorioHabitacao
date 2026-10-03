type PeriodTranslator = (
  key: "periodQuarter" | "periodSemester",
  values: { n: number; year: string },
) => string;

/**
 * "2026-Q2" → "2.º trim. 2026" / "Q2 2026"; "2025-S2" → "2.º sem. 2025" / "H2 2025".
 * Anything else (e.g. a plain year) is returned unchanged.
 */
export function formatPeriod(t: PeriodTranslator, period: string): string {
  const match = /^(\d{4})-([QS])(\d)$/.exec(period);
  if (!match) return period;
  const [, year, kind, n] = match;
  return t(kind === "Q" ? "periodQuarter" : "periodSemester", { n: Number(n), year: year! });
}
