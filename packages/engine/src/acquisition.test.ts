import { describe, expect, it } from "vitest";
import { params2025 as params } from "./__fixtures__/params2025";
import { acquisitionCosts, imt } from "./acquisition";

describe("imt", () => {
  it("applies the progressive table with the deduction", () => {
    expect(imt(250_000, "secondary", params)).toBe(8_289.69); // 7 % − 9 210.31
    expect(imt(250_000, "hpp", params)).toBe(7_247.08); // 7 % − 10 252.92
    expect(imt(100_000, "secondary", params)).toBe(1_000);
  });

  it("exempts the first bracket for own permanent home", () => {
    expect(imt(100_000, "hpp", params)).toBe(0);
  });

  it("ends the 8 % bracket at 621 501 € for other housing but 648 022 € for own home", () => {
    expect(imt(630_000, "secondary", params)).toBe(37_800); // flat 6 %
    expect(imt(630_000, "hpp", params)).toBe(36_906.5); // 8 % − 13 493.50
  });

  it("applies single rates to the top brackets", () => {
    expect(imt(700_000, "secondary", params)).toBe(42_000);
    expect(imt(1_200_000, "hpp", params)).toBe(90_000);
  });

  it("is continuous across the progressive brackets", () => {
    for (const use of ["hpp", "secondary"] as const) {
      const table = params.imt[use];
      for (let i = 0; i < 4; i++) {
        const edge = table[i]!.upTo!;
        expect(imt(edge, use, params)).toBeCloseTo(imt(edge + 0.01, use, params), 0);
      }
    }
  });

  it("applies the flat non-resident rate to housing when the year has one", () => {
    const with2026Rule = { ...params, imt: { ...params.imt, nonResidentHousingRate: 0.075 } };
    expect(imt(250_000, "secondary", with2026Rule, 0, true)).toBe(18_750);
    expect(imt(250_000, "hpp", with2026Rule, 0, true)).toBe(18_750);
    expect(imt(250_000, "secondary", with2026Rule, 0, false)).toBe(8_289.69);
    expect(imt(200_000, "otherUrban", with2026Rule, 0, true)).toBe(13_000);
    // Years without the rule ignore residency.
    expect(imt(250_000, "secondary", params, 0, true)).toBe(8_289.69);
  });

  it("taxes the VPT when it is higher than the price", () => {
    expect(imt(100_000, "secondary", params, 120_000)).toBe(1_357.39); // 2 % − 1 042.61
  });

  it("uses flat rates for other urban and rustic property", () => {
    expect(imt(200_000, "otherUrban", params)).toBe(13_000);
    expect(imt(50_000, "rustic", params)).toBe(2_500);
  });
});

describe("acquisitionCosts", () => {
  it("adds taxes and fees for a financed purchase", () => {
    const costs = acquisitionCosts(
      {
        price: 250_000,
        use: "secondary",
        loanAmount: 200_000,
        valuationFee: 250,
        processingFee: 300,
      },
      params,
    );
    expect(costs).toEqual({
      imt: 8_289.69,
      stampDutyPurchase: 2_000,
      stampDutyLoan: 1_200,
      deedAndRegistry: 700,
      valuationFee: 250,
      processingFee: 300,
      otherCosts: 0,
      total: 8_289.69 + 2_000 + 1_200 + 700 + 250 + 300,
      deductibleForCapitalGains: 8_289.69 + 2_000 + 700,
    });
  });

  it("skips loan costs without a loan and accepts overrides", () => {
    const costs = acquisitionCosts(
      { price: 250_000, use: "secondary", loanAmount: 0, deedAndRegistry: 500, otherCosts: 1_500 },
      params,
    );
    expect(costs.stampDutyLoan).toBe(0);
    expect(costs.valuationFee).toBe(0);
    expect(costs.processingFee).toBe(0);
    expect(costs.deedAndRegistry).toBe(500);
    expect(costs.total).toBeCloseTo(8_289.69 + 2_000 + 500 + 1_500, 2);
  });
});
