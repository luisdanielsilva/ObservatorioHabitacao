import { describe, expect, it } from "vitest";
import { compareListings, median } from "./comparables";
import { emptyComparable, initialState, normaliseState } from "./state";

const property = initialState({
  propertyType: "apartamento",
  bedrooms: 2,
  areaM2: 100,
  condition: "usado",
  askingPrice: 200_000, // 2 000 €/m²
  mapsUrl: "https://www.google.com/maps?q=41.550000,-8.420000",
});

const similar = (askingPrice: number | null, areaM2: number | null, extra = {}) =>
  emptyComparable({ bedrooms: 2, condition: "usado", askingPrice, areaM2, ...extra });

describe("compareListings", () => {
  it("compares the price per m² with the similar listings' median", () => {
    const summary = compareListings({
      ...property,
      comparables: [
        similar(220_000, 100), // 2 200
        similar(250_000, 100), // 2 500
        similar(180_000, 100), // 1 800
        similar(null, 90), // no price: not counted
      ],
    });
    expect(summary.count).toBe(3);
    expect(summary.tooFew).toBe(false);
    expect(summary.medianPerM2).toBe(2200);
    expect(summary.minPerM2).toBe(1800);
    expect(summary.maxPerM2).toBe(2500);
    expect(summary.medianPrice).toBe(220_000);
    expect(summary.pricePerM2).toBe(2000);
    expect(summary.valueAtMedian).toBe(220_000);
    expect(summary.dearer).toBe(2);
    expect(summary.opportunity?.signal).toBe("opportunity");
    expect(summary.opportunity?.difference).toBeCloseTo(2000 / 2200 - 1);
    expect(summary.rows[0]!.difference).toBeCloseTo(2000 / 2200 - 1);
    expect(summary.rows[3]!.pricePerM2).toBeNull();
  });

  it("asks for more listings below the minimum", () => {
    const summary = compareListings({ ...property, comparables: [similar(220_000, 100)] });
    expect(summary.tooFew).toBe(true);
    expect(compareListings(property)).toMatchObject({
      count: 0,
      medianPerM2: null,
      opportunity: null,
    });
  });

  it("notes what sets a listing apart, when known", () => {
    const [same, other] = compareListings({
      ...property,
      comparables: [
        similar(1, 110, { bedrooms: null, condition: null }),
        similar(1, 140, { propertyType: "moradia", bedrooms: 3, condition: "novo" }),
      ],
    }).rows;
    expect(same!.differences).toEqual([]);
    expect(other!.differences).toEqual(["type", "bedrooms", "area", "condition"]);
  });

  it("gives the distance when both places are in their map links, and only safe links", () => {
    const [near, unknown] = compareListings({
      ...property,
      comparables: [
        similar(1, 1, {
          url: "https://www.imovirtual.com/pt/anuncio/x",
          mapsUrl: "https://www.google.com/maps?q=41.559000,-8.420000",
        }),
        similar(1, 1, { url: "javascript:alert(1)", mapsUrl: "https://example.com/?q=41.5,-8.4" }),
      ],
    }).rows;
    expect(near!.distanceKm).toBeCloseTo(1.0, 1);
    expect(near!.listingUrl).toBe("https://www.imovirtual.com/pt/anuncio/x");
    expect(near!.mapsUrl).toBe("https://www.google.com/maps?q=41.559000,-8.420000");
    expect(unknown).toMatchObject({ distanceKm: null, listingUrl: null, mapsUrl: null });
  });
});

describe("median", () => {
  it("takes the middle value, or the mean of the two middle ones", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("normaliseState: comparables", () => {
  it("keeps valid listings, fixes wrong values and caps the list", () => {
    const state = normaliseState({
      comparables: [
        {
          url: "https://www.imovirtual.com/pt/anuncio/x",
          propertyType: "moradia",
          bedrooms: 7,
          areaM2: 90,
          condition: "novo",
          askingPrice: 250_000,
          location: "Braga",
          mapsUrl: "https://www.google.com/maps?q=41.5,-8.4",
          evil: "<script>",
        },
        { source: "auto", propertyType: "castle", bedrooms: 1.5, areaM2: -3, askingPrice: "1" },
        "nope",
      ],
    });
    expect(state.comparables[0]).toEqual({
      source: "user",
      url: "https://www.imovirtual.com/pt/anuncio/x",
      propertyType: "moradia",
      bedrooms: 5,
      areaM2: 90,
      condition: "novo",
      askingPrice: 250_000,
      location: "Braga",
      mapsUrl: "https://www.google.com/maps?q=41.5,-8.4",
    });
    expect(state.comparables[1]).toEqual(emptyComparable({ source: "auto" }));
    expect(state.comparables[2]).toEqual(emptyComparable());
    expect(normaliseState({ comparables: Array(20).fill({}) }).comparables).toHaveLength(10);
    expect(normaliseState({ comparables: "x" }).comparables).toEqual([]);
  });
});
