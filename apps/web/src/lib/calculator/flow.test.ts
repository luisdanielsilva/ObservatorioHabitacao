import { describe, expect, it } from "vitest";
import { initialStep, missingDealFields, missingPropertyFields } from "./flow";
import type { CalculatorOutput } from "./run";
import { initialState } from "./state";

const complete = initialState({ askingPrice: 250_000, bedrooms: 2, areaM2: 80, areaId: 42 });

const outputWith = (missing: CalculatorOutput["outcomes"][number]["missing"]) =>
  ({
    outcomes: [{ kind: "longTermRental", missing }],
  }) as unknown as CalculatorOutput;

describe("missingPropertyFields", () => {
  it("lists every required field of an empty form", () => {
    expect(missingPropertyFields(initialState(), 0)).toEqual([
      "askingPrice",
      "bedrooms",
      "areaM2",
      "areaId",
    ]);
  });

  it("does not ask for a typology for land or shops", () => {
    expect(
      missingPropertyFields({ ...complete, propertyType: "terreno", bedrooms: null }, 3),
    ).toEqual([]);
    expect(missingPropertyFields({ ...complete, bedrooms: null }, 3)).toEqual(["bedrooms"]);
  });

  it("accepts T0", () => {
    expect(missingPropertyFields({ ...complete, bedrooms: 0 }, 3)).toEqual([]);
  });

  it("needs at least the municipality", () => {
    expect(missingPropertyFields(complete, 1)).toEqual(["areaId"]);
    expect(missingPropertyFields(complete, 2)).toEqual([]);
  });
});

describe("missingDealFields / initialStep", () => {
  it("starts at the property until it is complete", () => {
    expect(initialStep(initialState({ deal: "flip" }), null, 0)).toBe("property");
  });

  it("asks for the deal, then its details, then shows results", () => {
    expect(initialStep(complete, null, 3)).toBe("deal");
    const rental = { ...complete, deal: "longTermRental" as const };
    expect(initialStep(rental, outputWith(["monthlyRent"]), 3)).toBe("details");
    expect(missingDealFields(outputWith(["monthlyRent"]), "longTermRental")).toEqual([
      "monthlyRent",
    ]);
    expect(initialStep(rental, outputWith(undefined), 3)).toBe("results");
  });
});
