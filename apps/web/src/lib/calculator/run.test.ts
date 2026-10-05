import type { ParameterSet } from "@olhovivo/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { runCalculator } from "./run";
import { initialState } from "./state";

const params: ParameterSet = params2025;
const run = (overrides: Parameters<typeof initialState>[0]) =>
  runCalculator(initialState(overrides), params, 1);
const outcome = (out: ReturnType<typeof run>, kind: string) =>
  out.outcomes.find((o) => o.kind === kind)!;

describe("runCalculator", () => {
  it("reports what is missing instead of guessing market values", () => {
    const out = run({ askingPrice: 250_000 });
    expect(outcome(out, "flip").missing).toEqual(["resaleValue"]);
    expect(outcome(out, "longTermRental").missing).toEqual(["monthlyRent", "marketValue"]);
    expect(outcome(out, "shortTermRental").missing).toEqual(["nightly", "marketValue"]);
    expect(outcome(out, "contractAssignment").missing).toEqual(["cessao", "marketValue"]);
    expect(out.comparison.best).toBeNull();
  });

  it("needs a purchase price for the property scenarios", () => {
    const out = run({ resaleValue: 300_000 });
    expect(outcome(out, "flip").missing).toEqual(["purchasePrice"]);
  });

  it("uses the asking price and the most banks lend for the use by default", () => {
    const out = run({ askingPrice: 200_000, resaleValue: 260_000 });
    expect(out.purchasePrice).toBe(200_000);
    expect(out.loanAmount).toBe(160_000); // 80 % for investment / second homes
    const flip = outcome(out, "flip").result!;
    expect(flip.loanAmount).toBe(160_000);
    expect(flip.warnings).not.toContain("ltv_above_limit");
    expect(flip.months).toHaveLength(13); // purchase + 12 months

    const home = run({ askingPrice: 200_000, resaleValue: 260_000, propertyUse: "hpp" });
    expect(home.loanAmount).toBe(180_000); // 90 % for an own permanent home
    expect(outcome(home, "flip").result!.warnings).not.toContain("ltv_above_limit");
  });

  it("taxes a sale gain at the IRS brackets on top of other income", () => {
    const flip = (otherTaxableIncome: number | null) =>
      outcome(
        run({ askingPrice: 200_000, resaleValue: 260_000, otherTaxableIncome }),
        "flip",
      ).result!.months.at(-1)!.capitalGainsTax;
    // The same gain costs more for someone with a higher income; empty counts as no income.
    expect(flip(60_000)).toBeGreaterThan(flip(10_000));
    expect(flip(null)).toBe(flip(0));
  });

  it("keeps a loan amount the user entered", () => {
    expect(run({ askingPrice: 200_000, loanAmount: 100_000, propertyUse: "hpp" }).loanAmount).toBe(
      100_000,
    );
  });

  it("runs without a loan when financing is off", () => {
    const out = run({ askingPrice: 200_000, resaleValue: 260_000, useLoan: false });
    expect(outcome(out, "flip").result!.loanAmount).toBe(0);
  });

  it("runs all four scenarios with complete values and ranks them", () => {
    const out = run({
      askingPrice: 200_000,
      marketValue: 220_000,
      resaleValue: 260_000,
      renovationBudget: 20_000,
      renovationMonths: 3,
      monthlyRent: 1_000,
      nightlyRate: { high: 120, mid: 90, low: 70 },
      occupancy: { high: 0.85, mid: 0.7, low: 0.5 },
      deposit: 20_000,
      assignmentPrice: 35_000,
      goal: "profit",
    });
    expect(out.outcomes.every((o) => o.result)).toBe(true);
    expect(out.comparison.ranking).toHaveLength(4);
    expect(out.opportunity?.signal).toBe("opportunity"); // 200 000 vs 220 000 = −9 %

    // Rentals are sold at the renovated value, with no appreciation.
    const rental = outcome(out, "longTermRental").result!;
    const sale = rental.months.at(-1)!.saleProceeds;
    expect(sale).toBeCloseTo(260_000 * (1 - 0.05 * 1.23), 2);
  });

  it("hides the AL registry warning until the registry exists", () => {
    const out = run({
      askingPrice: 200_000,
      marketValue: 200_000,
      nightlyRate: { high: 120, mid: 90, low: 70 },
      occupancy: { high: 0.85, mid: 0.7, low: 0.5 },
    });
    expect(outcome(out, "shortTermRental").result!.warnings).not.toContain("al_status_unknown");
  });

  it("defaults the CPCV price to the purchase price", () => {
    const out = run({
      askingPrice: 300_000,
      marketValue: 340_000,
      deposit: 30_000,
      assignmentPrice: 50_000,
    });
    const cessao = outcome(out, "contractAssignment").result!;
    expect(cessao.ownCapital).toBe(30_000);
    expect(cessao.returnOnDeposit).toBeGreaterThan(0);
  });
});
