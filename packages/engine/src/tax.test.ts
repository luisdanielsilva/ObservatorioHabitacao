import { describe, expect, it } from "vitest";
import { params2025 } from "./__fixtures__/params2025";
import { gainTax, irsOnExtraIncome, irsSlicesOnExtraIncome, irsTax } from "./tax";

describe("irsTax (2025 table)", () => {
  it("is 12.5 % in the first bracket", () => {
    expect(irsTax(8_000, params2025)).toBeCloseTo(1_000, 6);
  });

  it("applies each rate to its own slice of income", () => {
    // 8 059 × 12.5 % + (12 160 − 8 059) × 16 % = 1 007.375 + 656.16 = 1 663.535
    expect(irsTax(12_160, params2025)).toBeCloseTo(1_663.535, 6);
    // Same as the official average rate of the 2nd bracket: 13.68 %.
    expect(irsTax(12_160, params2025) / 12_160).toBeCloseTo(0.1368, 4);
  });

  it("adds the solidarity surcharge above 80 000 €", () => {
    const below = irsTax(80_000, params2025);
    // 20 000 more at 44.6 % up to 83 696 and 48 % beyond, plus 2.5 % surcharge.
    const expected = below + 3_696 * 0.446 + 16_304 * 0.48 + 20_000 * 0.025;
    expect(irsTax(100_000, params2025)).toBeCloseTo(expected, 6);
  });

  it("is zero for no or negative income", () => {
    expect(irsTax(0, params2025)).toBe(0);
    expect(irsTax(-500, params2025)).toBe(0);
  });
});

describe("irsOnExtraIncome", () => {
  it("taxes the extra at the rates of the brackets it falls in", () => {
    // 30 000 + 5 000: all in the 34.9 % bracket.
    expect(irsOnExtraIncome(30_000, 5_000, params2025)).toBeCloseTo(1_745, 6);
    // With no other income, the extra starts in the lowest bracket.
    expect(irsOnExtraIncome(0, 8_000, params2025)).toBeCloseTo(1_000, 6);
  });

  it("is zero for a loss", () => {
    expect(irsOnExtraIncome(30_000, -1_000, params2025)).toBe(0);
  });
});

describe("irsSlicesOnExtraIncome", () => {
  it("splits the extra income by bracket, with taxes adding up to irsOnExtraIncome", () => {
    const slices = irsSlicesOnExtraIncome(8_000, 5_000, params2025);
    expect(slices.map((s) => s.bracket)).toEqual([1, 2, 3]);
    expect(slices.map((s) => s.amount)).toEqual([59, 4_101, 840]);
    const total = slices.reduce((sum, s) => sum + s.tax, 0);
    expect(total).toBeCloseTo(irsOnExtraIncome(8_000, 5_000, params2025), 6);
  });

  it("includes the solidarity surcharge as bands without a bracket", () => {
    const slices = irsSlicesOnExtraIncome(90_000, 10_000, params2025);
    expect(slices).toEqual([
      { bracket: 9, rate: 0.48, amount: 10_000, tax: 4_800 },
      { bracket: null, rate: 0.025, amount: 10_000, tax: 250 },
    ]);
  });

  it("is empty with nothing to add", () => {
    expect(irsSlicesOnExtraIncome(20_000, 0, params2025)).toEqual([]);
  });
});

describe("gainTax", () => {
  const lines = (sale: number) => [
    { key: "salePrice" as const, amount: sale },
    { key: "purchasePrice" as const, amount: -250_000 },
  ];

  it("taxes the included share of a gain on top of the other income", () => {
    const g = gainTax(lines(251_000), 0.5, 0, params2025);
    expect(g.gain).toBe(1_000);
    expect(g.taxable).toBe(500);
    expect(g.slices).toEqual([{ bracket: 1, rate: 0.125, amount: 500, tax: 62.5 }]);
    expect(g.tax).toBe(62.5);
  });

  it("has no tax on a loss", () => {
    const g = gainTax(lines(249_000), 0.5, 30_000, params2025);
    expect(g.gain).toBe(-1_000);
    expect(g.taxable).toBe(0);
    expect(g.slices).toEqual([]);
    expect(g.tax).toBe(0);
  });
});
