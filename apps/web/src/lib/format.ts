/** Intl locale for each app locale: Portuguese as in Portugal, English with euro conventions. */
export function intlLocale(locale: string): string {
  return locale === "en" ? "en-IE" : "pt-PT";
}

export interface Formatter {
  /** 250 000 € */
  euro(value: number): string;
  /** 5 600 €/m² or 14,5 €/m² (one decimal below 100). */
  euroPerM2(value: number): string;
  /** 4,1 % */
  percent(value: number, digits?: number): string;
  /** +4,1 % */
  signedPercent(value: number, digits?: number): string;
  number(value: number, digits?: number): string;
}

export function createFormatter(locale: string): Formatter {
  const l = intlLocale(locale);
  const euro = new Intl.NumberFormat(l, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const euroDecimal = new Intl.NumberFormat(l, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return {
    euro: (v) => euro.format(Math.round(v)),
    euroPerM2: (v) => `${(Math.abs(v) < 100 ? euroDecimal : euro).format(v)}/m²`,
    percent: (v, digits = 1) =>
      new Intl.NumberFormat(l, { style: "percent", maximumFractionDigits: digits }).format(v),
    signedPercent: (v, digits = 1) =>
      new Intl.NumberFormat(l, {
        style: "percent",
        maximumFractionDigits: digits,
        signDisplay: "exceptZero",
      }).format(v),
    number: (v, digits = 0) =>
      new Intl.NumberFormat(l, { maximumFractionDigits: digits }).format(v),
  };
}
