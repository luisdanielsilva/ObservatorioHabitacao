import { describe, expect, it } from "vitest";
import { classifyOpportunity } from "./opportunity";
import { seasonsToMonths } from "./seasons";

describe("classifyOpportunity", () => {
  it("classifies against a ±5 % band", () => {
    const below = classifyOpportunity(180_000, 200_000);
    expect(below?.signal).toBe("opportunity");
    expect(below?.difference).toBeCloseTo(-0.1, 12);
    expect(classifyOpportunity(205_000, 200_000)?.signal).toBe("fair");
    expect(classifyOpportunity(190_000, 200_000)?.signal).toBe("fair"); // exactly −5 %
    expect(classifyOpportunity(210_000, 200_000)?.signal).toBe("fair"); // exactly +5 %
    expect(classifyOpportunity(230_000, 200_000)?.signal).toBe("above");
  });

  it("needs both prices", () => {
    expect(classifyOpportunity(0, 200_000)).toBeNull();
    expect(classifyOpportunity(200_000, Number.NaN)).toBeNull();
  });
});

describe("seasonsToMonths", () => {
  it("maps high, mid and low seasons onto calendar months", () => {
    expect(seasonsToMonths({ high: "H", mid: "M", low: "L" }).join("")).toBe("LLLMMHHHHMLL");
  });
});
