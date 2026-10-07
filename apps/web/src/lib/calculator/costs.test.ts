import type { ParameterSet } from "@olhovivo/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { ownershipCosts } from "./costs";
import { runCalculator } from "./run";
import { initialState } from "./state";

const params: ParameterSet = params2025;
const result = (kind: string, overrides: Parameters<typeof initialState>[0]) =>
  runCalculator(initialState(overrides), params, 1).outcomes.find((o) => o.kind === kind)!.result!;

describe("ownershipCosts", () => {
  it("counts a resale's costs only for the months until the sale", () => {
    const year = ownershipCosts(
      "flip",
      result("flip", { askingPrice: 200_000, resaleValue: 260_000 }),
    )!;
    const half = ownershipCosts(
      "flip",
      result("flip", { askingPrice: 200_000, resaleValue: 260_000, flipMonths: 6 }),
    )!;
    expect(year.months).toBe(12);
    expect(half.months).toBe(6);
    expect(half.total).toBeCloseTo(year.total / 2, 6);
    expect(half.items.maintenance).toBeUndefined();
  });

  it("adds maintenance to a rental's year: 10 % of the rent by default", () => {
    const costs = ownershipCosts(
      "longTermRental",
      result("longTermRental", { askingPrice: 200_000, monthlyRent: 1_000, vacancyMonths: 0 }),
    )!;
    expect(costs.months).toBeNull();
    expect(costs.items.maintenance).toBeCloseTo(12_000 * 0.1, 6);
    expect(costs.total).toBeCloseTo(
      costs.items.imi! + costs.items.condominium! + costs.items.insurance! + 1_200,
      6,
    );
  });

  it("is null for a deal that does not buy the property", () => {
    const assignment = result("contractAssignment", {
      askingPrice: 200_000,
      marketValue: 220_000,
      deposit: 20_000,
      assignmentPrice: 35_000,
    });
    expect(ownershipCosts("contractAssignment", assignment)).toBeNull();
  });
});
