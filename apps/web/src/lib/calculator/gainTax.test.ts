import { gainTax } from "@observatorio-habitacao/engine";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import messages from "../../../messages/pt.json";
import { createFormatter } from "../format";
import { describeGainTax, gainTaxChartNote } from "./gainTax";

const t = createTranslator({ locale: "pt", messages, namespace: "gainTax" });
const f = createFormatter("pt");
// Non-breaking spaces from Intl, as plain spaces.
const plain = (s: string) => s.replace(/\s/g, " ");

const sale = (price: number) => [
  { key: "salePrice" as const, amount: price },
  { key: "sellingCommission" as const, amount: -price * 0.05 * 1.23, rate: 0.05 },
  { key: "purchasePrice" as const, amount: -250_000 },
  { key: "acquisitionCosts" as const, amount: -10_664.69 },
  { key: "renovation" as const, amount: 0 },
];

describe("describeGainTax", () => {
  it("shows the gain, the share taxed and the bracket, without zero amounts", () => {
    const text = describeGainTax(gainTax(sale(278_685), 0.5, 0, params2025), t, f);
    expect(plain(text.price)).toBe("Com a venda a 278 685 €");
    expect(text.rows.map((r) => r.label)).toEqual([
      "Preço de venda",
      "Comissão da agência (5% + IVA)",
      "Preço de compra",
      "IMT, Imposto do Selo e escritura",
      "Mais-valia (ganho)",
      "Parte tributada (50% do ganho)",
      "IRS sobre a mais-valia",
    ]);
    expect(plain(text.rows.at(-1)!.value)).toBe("55 €");
    expect(plain(text.notes[0]!)).toContain("12,5% (1.º escalão) sobre 441 €");
    // Holding costs are not deducted; other income at zero means the lowest bracket.
    expect(text.notes).toHaveLength(3);
  });

  it("says there is no tax without a gain", () => {
    const text = describeGainTax(gainTax(sale(275_000), 0.5, 0, params2025), t, f);
    expect(text.rows.at(-1)!.label).toBe("Mais-valia (ganho)");
    expect(text.notes).toEqual(["Sem ganho a este preço: não há IRS sobre a mais-valia."]);
  });

  it("lists each bracket the gain falls in, with the other income entered", () => {
    const text = describeGainTax(gainTax(sale(320_000), 0.5, 40_000, params2025), t, f);
    expect(plain(text.notes[0]!)).toMatch(/34,9% \(6\.º escalão\) .*43,1% \(7\.º escalão\)/);
    expect(text.notes).toHaveLength(2);
  });
});

describe("gainTaxChartNote", () => {
  it("explains the chart's tax bar, and nothing without one", () => {
    const note = gainTaxChartNote(gainTax(sale(278_685), 0.5, 0, params2025), t, f)!;
    expect(plain(note)).toMatch(/^IRS mais-valia: 55 €\. Com a venda a 278 685 €, o ganho é 881 €/);
    expect(gainTaxChartNote(gainTax(sale(275_000), 0.5, 0, params2025), t, f)).toBeNull();
  });
});
