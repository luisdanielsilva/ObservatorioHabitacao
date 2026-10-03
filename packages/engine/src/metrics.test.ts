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
