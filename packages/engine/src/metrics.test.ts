import { describe, expect, it } from "vitest";
import { annualise, irr, npv } from "./metrics";

describe("npv", () => {
  it("discounts each period", () => {
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
    expect(npv(0, [-100, 30, 30, 30])).toBe(-10);
  });
});

describe("irr", () => {
  it("finds the rate for a single-period investment", () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
  });

  it("matches a known multi-period result (spreadsheet IRR)", () => {
    // =IRR({-1000;300;400;500}) ≈ 8.8963% (NPV verified ≈ 0 independently)
    expect(irr([-1000, 300, 400, 500])).toBeCloseTo(0.088963, 5);
  });

  it("handles negative returns", () => {
    expect(irr([-100, 90])).toBeCloseTo(-0.1, 8);
  });

  it("handles long monthly series (10 years)", () => {
    // −100 000 now, −500 a month for 119 months, then +250 000: ≈ 0.38 % a month.
    const flows = [-100_000, ...Array(119).fill(-500), 250_000 - 500];
    const rate = irr(flows)!;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.01);
    expect(Math.abs(npv(rate, flows))).toBeLessThan(0.01); // cents, on 250 000 € of flows
  });

  it("returns null when there is no sign change", () => {
    expect(irr([100, 50])).toBeNull();
    expect(irr([-100, -50])).toBeNull();
  });
});

describe("annualise", () => {
  it("compounds a monthly rate", () => {
    expect(annualise(0.01)).toBeCloseTo(0.126825, 6);
  });
});
