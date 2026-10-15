import { describe, expect, it } from "vitest";
import { distanceKm, googleMapsUrl, mapsUrlForPoint, pointFromMapsUrl } from "./mapsLink";

describe("googleMapsUrl", () => {
  it("accepts Google Maps links, as https", () => {
    for (const link of [
      "https://maps.app.goo.gl/AbCdEf123",
      "https://www.google.com/maps/place/Braga/@41.5,-8.4,15z",
      "https://www.google.pt/maps/@41.54579,-8.432778,17z",
      "https://maps.google.com/?q=41.5,-8.4",
      "https://goo.gl/maps/xyz",
      "https://www.google.co.uk/maps?q=Braga",
    ]) {
      expect(googleMapsUrl(link)).toBe(new URL(link).href);
    }
    expect(googleMapsUrl("  http://maps.app.goo.gl/AbC  ")).toBe("https://maps.app.goo.gl/AbC");
  });

  it("refuses anything that is not a Google Maps address", () => {
    for (const link of [
      "",
      "Rua Direita, Braga",
      "https://www.google.com/search?q=braga",
      "https://maps.app.goo.gl/",
      "https://google.com.evil.example/maps",
      "https://www.google.com.example.com/maps",
      "javascript:alert(1)",
      "https://user@www.google.com/maps",
      "https://www.openstreetmap.org/#map=17/41.5/-8.4",
    ]) {
      expect(googleMapsUrl(link)).toBeNull();
    }
  });
});

describe("mapsUrlForPoint", () => {
  it("is a valid Google Maps link to the coordinates", () => {
    const link = mapsUrlForPoint(41.54579, -8.432778);
    expect(link).toBe("https://www.google.com/maps?q=41.545790,-8.432778");
    expect(googleMapsUrl(link)).toBe(link);
  });
});

describe("pointFromMapsUrl", () => {
  it("reads the point written in a Google Maps link", () => {
    expect(pointFromMapsUrl(mapsUrlForPoint(41.54579, -8.432778))).toEqual({
      lat: 41.54579,
      lng: -8.432778,
    });
    expect(pointFromMapsUrl("https://www.google.pt/maps/@41.54579,-8.432778,17z")).toEqual({
      lat: 41.54579,
      lng: -8.432778,
    });
    expect(pointFromMapsUrl("https://www.google.com/maps/place/38.7,-9.14")).toEqual({
      lat: 38.7,
      lng: -9.14,
    });
  });

  it("is null without a point, or for other sites", () => {
    expect(pointFromMapsUrl("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(pointFromMapsUrl("https://www.google.co.uk/maps?q=Braga")).toBeNull();
    expect(pointFromMapsUrl("https://example.com/?q=41.5,-8.4")).toBeNull();
    expect(pointFromMapsUrl("https://www.google.com/maps?q=95,-8.4")).toBeNull();
  });
});

describe("distanceKm", () => {
  it("measures in a straight line", () => {
    // Lisbon to Porto: about 274 km.
    expect(distanceKm({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 })).toBeCloseTo(
      274,
      -1,
    );
  });
});
