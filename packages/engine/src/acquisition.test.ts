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
      { price: 250_000, use: "secondary", loanAmount: 200_000 },
      params,
    );
    expect(costs).toEqual({
      imt: 8_289.69,
      stampDutyPurchase: 2_000,
      stampDutyLoan: 1_200,
      deedAndRegistry: 700,
      bankFees: 800,
      otherCosts: 0,
      total: 8_289.69 + 2_000 + 1_200 + 700 + 800,
      deductibleForCapitalGains: 8_289.69 + 2_000 + 700,
    });
  });

  it("skips loan costs without a loan and accepts overrides", () => {
    const costs = acquisitionCosts(
      { price: 250_000, use: "secondary", loanAmount: 0, deedAndRegistry: 500, otherCosts: 1_500 },
      params,
    );
    expect(costs.stampDutyLoan).toBe(0);
    expect(costs.bankFees).toBe(0);
    expect(costs.deedAndRegistry).toBe(500);
    expect(costs.total).toBeCloseTo(8_289.69 + 2_000 + 500 + 1_500, 2);
  });
});
