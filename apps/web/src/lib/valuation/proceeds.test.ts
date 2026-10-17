import { irsOnExtraIncome } from "@observatorio-habitacao/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { monetaryCoefficient } from "./coefficients";
import { sellerProceeds } from "./proceeds";
import { initialValuation, normaliseValuation } from "./state";

const sale = initialValuation({
  areaM2: 100,
  purchasePrice: 200_000,
  purchaseYear: 2015,
  purchaseCosts: 10_000,
  works: 20_000,
});

describe("monetaryCoefficient", () => {
  it("reads the Portaria's table, ranges included", () => {
    expect(monetaryCoefficient(1989, 2026)).toBe(3);
    expect(monetaryCoefficient(2013, 2026)).toBe(1.2);
    expect(monetaryCoefficient(2019, 2026)).toBe(1.17);
    expect(monetaryCoefficient(2024, 2026)).toBe(1);
  });

  it("is 1 when held under two years or for a year not in the table yet", () => {
    expect(monetaryCoefficient(2025, 2026)).toBe(1);
    expect(monetaryCoefficient(2023, 2024)).toBe(1);
  });
});

describe("sellerProceeds", () => {
  it("takes the commission with VAT, the IRS on the gain and the loan from the price", () => {
    const p = sellerProceeds(
      { ...sale, loanBalance: 100_000, otherSaleCosts: 300 },
      400_000,
      params2025,
      2026,
    );
    expect(p.commission).toBeCloseTo(400_000 * 0.05 * 1.23);
    expect(p.earlyRepaymentFee).toBeCloseTo(500);
    const g = p.gainTax!;
    // 2015 → coefficient 1.20: the purchase counts as 240 000.
    expect(g.coefficient).toBe(1.2);
    expect(g.lines.find((l) => l.key === "monetaryCorrection")!.amount).toBeCloseTo(-40_000);
    expect(g.gain).toBeCloseTo(400_000 - 24_600 - 300 - 240_000 - 10_000 - 20_000);
    expect(g.taxable).toBeCloseTo(g.gain * 0.5);
    expect(g.tax).toBeCloseTo(irsOnExtraIncome(0, g.taxable, params2025));
    expect(p.net).toBeCloseTo(400_000 - 24_600 - 300 - g.tax - 100_000 - 500);
  });

  it("does not tax a loss", () => {
    const g = sellerProceeds(sale, 220_000, params2025, 2026).gainTax!;
    expect(g.gain).toBeLessThan(0);
    expect(g.tax).toBe(0);
  });

  it("does not tax a home bought before 1989", () => {
    const g = sellerProceeds({ ...sale, purchaseYear: 1985 }, 400_000, params2025, 2026).gainTax!;
    expect(g).toMatchObject({ untaxed: true, tax: 0, coefficient: 1 });
  });

  it("excludes the share reinvested in a new own home, measured against the price less the loan", () => {
    const home = { ...sale, ownHome: true, loanBalance: 100_000 };
    const half = sellerProceeds({ ...home, reinvestment: 150_000 }, 400_000, params2025, 2026);
    expect(half.gainTax!.reinvestedShare).toBeCloseTo(0.5);
    expect(half.gainTax!.taxable).toBeCloseTo(half.gainTax!.gain * 0.5 * 0.5);

    const all = sellerProceeds({ ...home, reinvestment: 300_000 }, 400_000, params2025, 2026);
    expect(all.gainTax).toMatchObject({ reinvestedShare: 1, tax: 0 });

    // Only for an own permanent home.
    const notHome = sellerProceeds(
      { ...home, ownHome: false, reinvestment: 300_000 },
      400_000,
      params2025,
      2026,
    );
    expect(notHome.gainTax!.reinvestedShare).toBe(0);
  });

  it("leaves the IRS out until the purchase price is known", () => {
    const p = sellerProceeds({ ...sale, purchasePrice: null }, 400_000, params2025, 2026);
    expect(p.gainTax).toBeNull();
    expect(p.net).toBeCloseTo(400_000 - 24_600);
  });
});

describe("normaliseValuation", () => {
  it("keeps valid values and drops the rest", () => {
    const v = normaliseValuation({
      areaId: 12,
      propertyType: "moradia",
      bedrooms: 9,
      areaM2: -5,
      floor: 30,
      features: { elevator: true, garage: "yes" },
      purchaseYear: 1850,
      sellingCommissionRate: 3,
      ownHome: true,
      comparables: [{ askingPrice: 100, features: { garage: false } }],
    });
    expect(v).toMatchObject({
      areaId: 12,
      propertyType: "moradia",
      bedrooms: 5,
      areaM2: null,
      floor: 10,
      features: { elevator: true, garage: false, balcony: false },
      purchaseYear: null,
      sellingCommissionRate: 0.05,
      ownHome: true,
    });
    expect(v.comparables[0]!.features).toEqual({ elevator: null, garage: false, balcony: null });
    expect(normaliseValuation(null)).toEqual(initialValuation());
  });
});
