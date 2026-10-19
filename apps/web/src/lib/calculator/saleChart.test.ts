import type { ParameterSet } from "@observatorio-habitacao/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { saleAnalysis } from "./sale";
import { breakdownAtSale, priceSplit, saleWaterfall } from "./saleChart";
import { initialState } from "./state";

const params: ParameterSet = params2025;
const state = initialState({
  askingPrice: 200_000,
  resaleValue: 260_000,
  monthlyRent: 1_000,
  marketValue: 210_000,
  deposit: 20_000,
  assignmentPrice: 35_000,
  useLoan: true,
});
const at = (deal: Parameters<typeof breakdownAtSale>[3], price: number) =>
  breakdownAtSale(state, params, 1, deal, price)!;

describe("priceSplit", () => {
  it("splits a resale price into loan, money back, commission and IRS, and profit", () => {
    const split = priceSplit(260_000, at("flip", 260_000))!;
    expect(split.loan).toBeGreaterThan(0);
    expect(split.ownMoney).toBeGreaterThan(0);
    expect(split.costs).toBeGreaterThan(0);
    expect(split.loan + split.ownMoney + split.costs + split.profit).toBeCloseTo(260_000, 2);
  });

  it("has a profit of about zero at the lowest price without a loss", () => {
    const { breakEven } = saleAnalysis(state, params, 1, "flip")!;
    expect(priceSplit(breakEven!, at("flip", breakEven!))!.profit).toBeCloseTo(0, -2);
  });

  it("cannot stack a loss", () => {
    expect(priceSplit(150_000, at("flip", 150_000))).toBeNull();
  });
});

describe("saleWaterfall", () => {
  it("goes from the sale price down to the profit, each bar from where the last one ended", () => {
    const b = at("flip", 260_000);
    const bars = saleWaterfall(260_000, b);
    expect(bars[0]).toEqual({ key: "price", from: 0, to: 260_000, value: 260_000 });
    expect(bars.at(-1)).toEqual({ key: "profit", from: 0, to: b.total, value: b.total });
    const flows = bars.slice(1, -1);
    flows.forEach((bar, i) => {
      expect(bar.from).toBeCloseTo((i === 0 ? bars[0]! : flows[i - 1]!).to, 6);
      expect(bar.to - bar.from).toBeCloseTo(bar.value, 6);
    });
    // The flows bring the price down to the profit exactly.
    expect(flows.at(-1)!.to).toBeCloseTo(b.total, 6);
    expect(flows.map((f) => f.key)).toContain("commission");
    expect(flows.map((f) => f.key)).not.toContain("income");
  });

  it("shows the rents of a rental as money in", () => {
    const bars = saleWaterfall(210_000, at("longTermRental", 210_000));
    expect(bars.find((b) => b.key === "income")!.value).toBeGreaterThan(0);
    expect(bars.at(-1)!.value).toBeCloseTo(bars.at(-2)!.to, 6);
  });

  it("has no loan for a contract assignment", () => {
    const bars = saleWaterfall(35_000, at("contractAssignment", 35_000));
    expect(bars.map((b) => b.key)).not.toContain("loanPayoff");
    expect(bars.find((b) => b.key === "initial")!.value).toBeCloseTo(-20_000, 0);
  });
});
