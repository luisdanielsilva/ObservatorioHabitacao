import { describe, expect, it } from "vitest";
import { emptyComparable } from "../calculator/state";
import { adjustmentFor, estimateValue, missingElevatorPenalty, type IneBase } from "./estimate";
import { initialValuation } from "./state";

const ine: IneBase = {
  value: 3000,
  period: "2026-Q1",
  areaName: "Arroios",
  level: "freguesia",
  yearOnYear: 0.08,
};
// A T2 of 100 m² with every feature, used, on the 3rd floor: the standard property.
const standard = initialValuation({
  areaId: 1,
  propertyType: "apartamento",
  bedrooms: 2,
  areaM2: 100,
  floor: 3,
  features: { elevator: true, garage: true, balcony: true },
});
const listing = (askingPrice: number, areaM2 = 100, extra = {}) =>
  emptyComparable({ askingPrice, areaM2, ...extra });

describe("missing features", () => {
  it("lowers an apartment without a lift from the 2nd floor, 5 % a floor up to 15 %", () => {
    expect([0, 1, 2, 3, 4, 7, null].map(missingElevatorPenalty)).toEqual([
      0, 0, 0.05, 0.1, 0.15, 0.15, 0,
    ]);
  });

  it("does not add anything for a feature the property has", () => {
    expect(adjustmentFor(standard)).toMatchObject({ factor: 1, shortfalls: [] });
  });

  it("multiplies the condition by each missing feature", () => {
    const a = adjustmentFor({
      ...standard,
      condition: "para_recuperar",
      floor: 2,
      features: { elevator: false, garage: false, balcony: true },
    });
    expect(a.shortfalls).toEqual([
      { feature: "elevator", penalty: 0.05 },
      { feature: "garage", penalty: 0.05 },
    ]);
    expect(a.factor).toBeCloseTo(0.75 * 0.95 * 0.95);
  });

  it("only applies a feature to the types it concerns (no lift or balcony for a house)", () => {
    const house = adjustmentFor({
      propertyType: "moradia",
      condition: "usado",
      floor: null,
      features: { elevator: false, garage: false, balcony: false },
    });
    expect(house.shortfalls.map((s) => s.feature)).toEqual(["garage"]);
  });
});

describe("estimateValue", () => {
  it("needs the area and at least the INE median or a priced listing", () => {
    expect(estimateValue({ ...standard, areaM2: null }, ine)).toBeNull();
    expect(estimateValue(standard, null)).toBeNull();
  });

  it("values a standard property at the INE median, with a wide range", () => {
    const v = estimateValue(standard, ine)!;
    expect(v).toMatchObject({
      basePerM2: 3000,
      perM2: 3000,
      likely: 300_000,
      low: 255_000,
      high: 345_000,
      confidence: "low",
      askingPrice: 315_000,
      weight: 0,
    });
  });

  it("lowers the seller's property for what it lacks", () => {
    const v = estimateValue(
      { ...standard, features: { elevator: false, garage: true, balcony: true } },
      ine,
    )!;
    expect(v.subject.shortfalls).toEqual([{ feature: "elevator", penalty: 0.1 }]);
    expect(v.likely).toBe(270_000);
  });

  it("ignores listings until there are 3, then blends them half and half", () => {
    const two = estimateValue(
      { ...standard, comparables: [listing(400_000), listing(400_000)] },
      ine,
    )!;
    expect(two).toMatchObject({ weight: 0, likely: 300_000, confidence: "low" });

    // Asking 4000 €/m² → 3600 €/m² expected (−10 % negotiation), the same property otherwise.
    const three = estimateValue(
      { ...standard, comparables: [listing(400_000), listing(400_000), listing(400_000)] },
      ine,
    )!;
    expect(three.comparablesMedian).toBeCloseTo(3600);
    expect(three).toMatchObject({ weight: 0.5, basePerM2: 3300, confidence: "medium" });
    expect(three.likely).toBe(330_000);
    expect(three.comparablesAskingPerM2).toBe(4000);
  });

  it("raises a listing that lacks a feature to the standard before using it", () => {
    // 3rd floor without a lift: worth 10 % less, so its standard €/m² is 3600 / 0.9 = 4000.
    const noLift = { features: { elevator: false, garage: null, balcony: null }, floor: 3 };
    const v = estimateValue(
      {
        ...standard,
        comparables: [
          listing(400_000, 100, noLift),
          listing(400_000, 100, noLift),
          listing(400_000, 100, noLift),
        ],
      },
      ine,
    )!;
    expect(v.comparables[0]!.adjustment.shortfalls).toEqual([
      { feature: "elevator", penalty: 0.1 },
    ]);
    expect(v.comparablesMedian).toBeCloseTo(4000);
  });

  it("takes what a listing does not say as the seller's, so it does not move it", () => {
    const seller = { ...standard, features: { elevator: false, garage: true, balcony: true } };
    const v = estimateValue(
      { ...seller, comparables: [listing(400_000), listing(400_000), listing(400_000)] },
      ine,
    )!;
    // The listings are taken as without a lift on the 3rd floor too: standard 3600 / 0.9.
    expect(v.comparablesMedian).toBeCloseTo(4000);
  });

  it("gives high confidence and 70 % weight from 5 listings", () => {
    const v = estimateValue(
      { ...standard, comparables: Array.from({ length: 5 }, () => listing(300_000)) },
      ine,
    )!;
    expect(v).toMatchObject({ weight: 0.7, confidence: "high" });
    expect(v.low).toBe(Math.round((v.perM2 * 100 * 0.93) / 1000) * 1000);
  });

  it("uses the listings alone, with low confidence, when there is no INE median", () => {
    const v = estimateValue({ ...standard, comparables: [listing(400_000)] }, null)!;
    expect(v).toMatchObject({ weight: 1, likely: 360_000, confidence: "low" });
  });
});
