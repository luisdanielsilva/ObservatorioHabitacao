import type { ParameterSet } from "@olhovivo/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { sensitivityDeltas, sensitivityTable, shiftState } from "./sensitivity";
import { initialState } from "./state";

const params: ParameterSet = params2025;
const state = initialState({
  askingPrice: 200_000,
  marketValue: 210_000,
  resaleValue: 260_000,
  monthlyRent: 1_000,
  nightlyRate: { high: 120, mid: 90, low: 70 },
  occupancy: { high: 0.9, mid: 0.7, low: 0.5 },
  deposit: 20_000,
  assignmentPrice: 35_000,
});

describe("shiftState", () => {
  it("shifts the price but keeps the loan, like the engine helper", () => {
    const s = shiftState(state, "price", 0.1);
    expect(s.purchasePrice).toBeCloseTo(220_000, 6);
    expect(s.loanAmount).toBe(140_000);
  });

  it("scales long-term rent and nightly rates together", () => {
    const s = shiftState(state, "rent", -0.1);
    expect(s.monthlyRent).toBe(900);
    expect(s.nightlyRate).toEqual({ high: 108, mid: 81, low: 63 });
  });

  it("moves occupancy in points within 0–100 %", () => {
    const { high, mid, low } = shiftState(state, "occupancy", 0.2).occupancy;
    expect(high).toBe(1);
    expect(mid).toBeCloseTo(0.9, 12);
    expect(low).toBeCloseTo(0.7, 12);
  });

  it("moves the interest rate in points, never below zero", () => {
    expect(shiftState(state, "interest", 0.01).interestRate).toBeCloseTo(0.045, 10);
    expect(shiftState(state, "interest", -0.1).interestRate).toBe(0);
  });

  it("leaves the state alone when there is no price", () => {
    const empty = initialState();
    expect(shiftState(empty, "price", 0.1)).toBe(empty);
  });
});

describe("sensitivityTable", () => {
  it("recalculates every scenario and moves results the expected way", () => {
    const rows = sensitivityTable(state, params, 1, "rent", "netYield", [-0.1, 0, 0.1]);
    expect(rows.map((r) => r.delta)).toEqual([-0.1, 0, 0.1]);
    expect(rows[0]!.longTermRental!).toBeLessThan(rows[2]!.longTermRental!);
    expect(rows[0]!.shortTermRental!).toBeLessThan(rows[2]!.shortTermRental!);
    expect(rows[1]!.flip).toBeNull(); // no yield for a flip

    const byRate = sensitivityTable(state, params, 1, "interest", "monthlyCashFlow", [0, 0.02]);
    expect(byRate[1]!.longTermRental!).toBeLessThan(byRate[0]!.longTermRental!);

    const byPrice = sensitivityTable(state, params, 1, "price", "netProfit", [-0.1, 0.1]);
    expect(byPrice[0]!.flip!).toBeGreaterThan(byPrice[1]!.flip!);
  });
});

describe("sensitivityDeltas", () => {
  it("spans the range and includes zero", () => {
    expect(sensitivityDeltas("price", 5)).toEqual([-0.2, -0.1, 0, 0.1, 0.2]);
    const interest = sensitivityDeltas("interest", 4);
    expect(interest[0]).toBe(-0.02);
    expect(interest.at(-1)).toBe(0.03);
    expect(interest).toContain(0);
  });
});
