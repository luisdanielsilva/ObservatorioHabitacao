import type { GainTax } from "@observatorio-habitacao/engine";
import type { useTranslations } from "next-intl";
import type { Formatter } from "@/lib/format";

type Translator = ReturnType<typeof useTranslations<"gainTax">>;

/** A row of the gain's calculation: a label and its amount. */
export interface GainTaxRow {
  label: string;
  value: string;
  /** The gain and the tax, in bold. */
  total?: boolean;
}

/** How the IRS on a sale's gain is reached, as text for the results page and the report. */
export interface GainTaxText {
  /** "Com a venda a 278 685 €". */
  price: string;
  rows: GainTaxRow[];
  /** Why the tax is what it is: the share taxed, the brackets, what is not deducted. */
  notes: string[];
}

/** "12,5 % (1.º escalão) sobre 441 €, 16 % (2.º escalão) sobre 300 €". */
export function gainTaxRates(g: GainTax, t: Translator, f: Formatter): string {
  return g.slices
    .map((s) =>
      s.bracket === null
        ? t("solidaritySlice", { rate: f.percent(s.rate), amount: f.euro(s.amount) })
        : t("bracketSlice", { rate: f.percent(s.rate), n: s.bracket, amount: f.euro(s.amount) }),
    )
    .join(", ");
}

/** What the gain comes from: the sale or the assignment price. */
function gainPrice(g: GainTax): { assignment: boolean; price: number } {
  const assignment = g.lines.find((l) => l.key === "assignmentPrice");
  return assignment
    ? { assignment: true, price: assignment.amount }
    : { assignment: false, price: g.lines.find((l) => l.key === "salePrice")?.amount ?? 0 };
}

export function describeGainTax(g: GainTax, t: Translator, f: Formatter): GainTaxText {
  const { assignment, price } = gainPrice(g);
  const share = f.percent(g.inclusionRate);
  const rows: GainTaxRow[] = [
    // Amounts of zero (no works, no other costs) are left out, but not the prices.
    ...g.lines
      .filter((l) => l.amount !== 0 || l.key === "salePrice" || l.key === "purchasePrice")
      .map((l) => ({
        label:
          l.key === "sellingCommission"
            ? t("lines.sellingCommission", { rate: f.percent(l.rate ?? 0) })
            : t(`lines.${l.key}`),
        value: f.euro(l.amount),
      })),
    { label: t("gain"), value: f.euro(g.gain), total: true },
  ];
  if (g.gain <= 0) {
    return {
      price: t(assignment ? "atAssignment" : "atSale", { price: f.euro(price) }),
      rows,
      notes: [t("noGain")],
    };
  }
  rows.push(
    { label: t("taxable", { share }), value: f.euro(g.taxable) },
    { label: t("tax"), value: f.euro(g.tax), total: true },
  );
  const notes = [
    t("explain", {
      share,
      taxable: f.euro(g.taxable),
      other: f.euro(g.otherTaxableIncome),
      rates: gainTaxRates(g, t, f),
    }),
  ];
  if (!assignment) notes.push(t("notDeducted"));
  if (g.otherTaxableIncome === 0) notes.push(t("otherZero"));
  return {
    price: t(assignment ? "atAssignment" : "atSale", { price: f.euro(price) }),
    rows,
    notes,
  };
}

/** The short note under a report's waterfall chart, when it has a tax bar. */
export function gainTaxChartNote(g: GainTax, t: Translator, f: Formatter): string | null {
  if (g.tax < 0.5) return null;
  const note = t("chartNote", {
    tax: f.euro(g.tax),
    price: f.euro(gainPrice(g).price),
    gain: f.euro(g.gain),
    share: f.percent(g.inclusionRate),
    taxable: f.euro(g.taxable),
    rates: gainTaxRates(g, t, f),
  });
  return g.otherTaxableIncome === 0 ? `${note} ${t("chartOtherZero")}` : note;
}
