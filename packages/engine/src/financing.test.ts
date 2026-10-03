import { describe, expect, it } from "vitest";
import { amortize, monthlyPayment } from "./financing";

describe("monthlyPayment", () => {
  it("matches the annuity formula", () => {
    // 200 000 € at 3.6 % TAN over 30 years
    expect(monthlyPayment(200_000, 0.036, 360)).toBeCloseTo(909.29, 2);
  });

  it("handles a zero rate", () => {
    expect(monthlyPayment(120_000, 0, 120)).toBe(1_000);
  });
});

describe("amortize", () => {
  const loan = { amount: 200_000, annualRate: 0.036, termYears: 30 };

  it("repays the full principal over the term", () => {
    const schedule = amortize(loan, 360, 0.04);
    expect(schedule).toHaveLength(360);
    expect(schedule.at(-1)!.balance).toBe(0);
    const principal = schedule.reduce((s, l) => s + l.principal, 0);
    expect(principal).toBeCloseTo(200_000, 6);
  });

  it("splits the first payment into interest and principal", () => {
    const [first] = amortize(loan, 1, 0.04);
    expect(first!.interest).toBeCloseTo(600, 6); // 200 000 × 0.3 %
    expect(first!.principal).toBeCloseTo(309.29, 2);
    expect(first!.stampDuty).toBeCloseTo(24, 6); // 4 % of interest
  });

  it("stops at the requested month", () => {
    const schedule = amortize(loan, 24, 0.04);
    expect(schedule).toHaveLength(24);
    expect(schedule.at(-1)!.balance).toBeGreaterThan(190_000);
  });
});
