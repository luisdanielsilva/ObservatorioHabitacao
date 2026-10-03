import { describe, expect, it } from "vitest";
import { initialState, normaliseState } from "./state";

describe("normaliseState", () => {
  it("keeps valid values and drops unknown keys", () => {
    const state = normaliseState({
      ...initialState({ askingPrice: 250_000, areaId: 24, goal: "irr" }),
      evil: "<script>",
    });
    expect(state.askingPrice).toBe(250_000);
    expect(state.areaId).toBe(24);
    expect(state.goal).toBe("irr");
    expect("evil" in state).toBe(false);
  });

  it("replaces wrongly typed values with defaults", () => {
    const state = normaliseState({
      askingPrice: "250000",
      interestRate: Number.NaN,
      useLoan: "yes",
      goal: "everything",
      nightlyRate: { high: 120, mid: "x" },
      extras: null,
    });
    const defaults = initialState();
    expect(state.askingPrice).toBeNull();
    expect(state.interestRate).toBe(defaults.interestRate);
    expect(state.useLoan).toBe(true);
    expect(state.goal).toBe("profit");
    expect(state.nightlyRate).toEqual({ high: 120, mid: null, low: null });
    expect(state.extras).toEqual(defaults.extras);
  });

  it("handles garbage input", () => {
    expect(normaliseState("nope")).toEqual(initialState());
    expect(normaliseState({ url: "x".repeat(5000) }).url).toHaveLength(2000);
  });
});
