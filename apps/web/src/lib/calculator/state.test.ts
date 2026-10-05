import { describe, expect, it } from "vitest";
import { initialState, normaliseState } from "./state";

describe("normaliseState", () => {
  it("keeps valid values and drops unknown keys", () => {
    const state = normaliseState({
      ...initialState({ askingPrice: 250_000, areaId: 24, propertyUse: "hpp" }),
      evil: "<script>",
    });
    expect(state.askingPrice).toBe(250_000);
    expect(state.areaId).toBe(24);
    expect(state.propertyUse).toBe("hpp");
    expect("evil" in state).toBe(false);
  });

  it("replaces wrongly typed values with defaults", () => {
    const state = normaliseState({
      askingPrice: "250000",
      interestRate: Number.NaN,
      useLoan: "yes",
      propertyUse: "everything",
      nightlyRate: { high: 120, mid: "x" },
      extras: null,
    });
    const defaults = initialState();
    expect(state.askingPrice).toBeNull();
    expect(state.interestRate).toBe(defaults.interestRate);
    expect(state.useLoan).toBe(false);
    expect(state.propertyUse).toBe("secondary");
    expect(state.nightlyRate).toEqual({ high: 120, mid: null, low: null });
    expect(state.extras).toEqual(defaults.extras);
  });

  it("handles garbage input", () => {
    expect(normaliseState("nope")).toEqual(initialState());
    expect(normaliseState({ url: "x".repeat(5000) }).url).toHaveLength(2000);
  });

  it("keeps known deals in order and reads the single deal of older scenarios", () => {
    expect(normaliseState({ deals: ["shortTermRental", "flip", "x", "flip"] }).deals).toEqual([
      "flip",
      "shortTermRental",
    ]);
    expect(normaliseState({ deal: "longTermRental" }).deals).toEqual(["longTermRental"]);
    expect(normaliseState({}).deals).toEqual([]);
  });
});
