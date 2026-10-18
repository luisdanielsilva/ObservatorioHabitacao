import { describe, expect, it } from "vitest";
import { OTHER_QUESTIONS, type Visual } from "./otherQuestions";

const visual = <K extends Visual["kind"]>(key: string, kind: K) => {
  const v = OTHER_QUESTIONS.find((q) => q.key === key)!.visual;
  expect(v.kind).toBe(kind);
  return v as Extract<Visual, { kind: K }>;
};

describe("the home page's example answers add up", () => {
  it("has the six cards, in order, each with both languages", () => {
    expect(OTHER_QUESTIONS.map((q) => q.key)).toEqual([
      "pricey",
      "strategy",
      "costs",
      "breakEven",
      "gainTax",
      "proceeds",
    ]);
    for (const q of OTHER_QUESTIONS) {
      for (const text of [q.question, q.answer]) {
        expect(text.pt).not.toBe("");
        expect(text.en).not.toBe("");
      }
    }
  });

  it("card 1: the listing is 18 % above the median, whose bar is about 85 % as long", () => {
    const v = visual("pricey", "versus");
    expect(Math.round((v.listing.perM2 / v.median.perM2 - 1) * 100)).toBe(18);
    expect(Math.round((v.median.perM2 / v.listing.perM2) * 100)).toBe(85);
  });

  it("card 3: the total is the sum of the costs", () => {
    const v = visual("costs", "receipt");
    expect(v.totalIsSum).toBe(true);
    expect(v.lines.reduce((sum, l) => sum + l.amount, 0)).toBe(v.total.amount);
  });

  it("card 4: each step is 5 % above the break-even price", () => {
    const v = visual("breakEven", "steps");
    expect(v.labels.map((_, i) => Math.round(v.base * (1 + (i * v.step) / 100)))).toEqual([
      214_000, 224_700, 235_400,
    ]);
  });

  it("card 5: the taxable gain is the gain less the correction, and its IRS is card 6's", () => {
    const v = visual("gainTax", "receipt");
    const subtotal = v.lines.findIndex((l) => l.subtotal);
    const above = v.lines.slice(0, subtotal).reduce((sum, l) => sum + l.amount, 0);
    expect(v.lines[subtotal].amount).toBe(above);
    const irs = visual("proceeds", "split").deductions.find((d) => d.label.pt === "IRS")!;
    expect(v.total.amount).toBe(irs.amount);
  });

  it("card 6: the sale price less the deductions is what you keep", () => {
    const v = visual("proceeds", "split");
    const deducted = v.deductions.reduce((sum, d) => sum + d.amount, 0);
    expect(v.price.amount - deducted).toBe(v.keep.amount);
    expect(v.keep.amount).toBe(187_000);
  });
});
