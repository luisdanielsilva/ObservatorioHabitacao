import { describe, expect, it } from "vitest";
import { extractProperty, toNumber } from "./extract";

const page = (jsonLd: unknown, head = "") => `<!doctype html><html><head>${head}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body></body></html>`;

describe("extractProperty", () => {
  it("reads a schema.org offer for an apartment", () => {
    const html = page({
      "@context": "https://schema.org",
      "@type": "Offer",
      price: "285000",
      priceCurrency: "EUR",
      itemOffered: {
        "@type": "Apartment",
        name: "T2 em Arroios",
        floorSize: { "@type": "QuantitativeValue", value: 72, unitCode: "MTK" },
        numberOfBedrooms: 2,
        address: {
          streetAddress: "Rua Morais Soares 10",
          postalCode: "1900-341",
          addressLocality: "Lisboa",
        },
        geo: { latitude: "38.7301", longitude: "-9.1335" },
        amenityFeature: [{ name: "Elevador" }, { name: "Varanda" }],
      },
    });
    expect(extractProperty(html)).toEqual({
      askingPrice: 285_000,
      propertyType: "apartamento",
      areaM2: 72,
      bedrooms: 2,
      address: "Rua Morais Soares 10, 1900-341, Lisboa",
      lat: 38.7301,
      lng: -9.1335,
      hasElevator: true,
      hasBalcony: true,
    });
  });

  it("follows @graph and caps bedrooms at T5+", () => {
    const html = page({
      "@graph": [
        { "@type": "WebPage", name: "Listing" },
        {
          "@type": ["Product", "SingleFamilyResidence"],
          numberOfBedrooms: 7,
          offers: { price: 650000, priceCurrency: "EUR" },
        },
      ],
    });
    expect(extractProperty(html)).toMatchObject({
      propertyType: "moradia",
      bedrooms: 5,
      askingPrice: 650_000,
    });
  });

  it("takes the typology from the title, not from the number of rooms", () => {
    const html = page({
      "@type": "Product",
      name: "T2, apartamento para comprar - Rua Dom Nuno Álvares Pereira, Matosinhos",
      numberOfRooms: 3,
      offers: { price: 480000, priceCurrency: "EUR" },
    });
    expect(extractProperty(html).bedrooms).toBe(2);
  });

  it("falls back to Open Graph price tags and ignores other currencies", () => {
    const head = `<meta property="og:title" content="Loja &amp; armazém">
      <meta property="product:price:amount" content="120.000"><meta property="product:price:currency" content="EUR">`;
    expect(extractProperty(`<html><head>${head}</head></html>`)).toEqual({
      title: "Loja & armazém",
      askingPrice: 120_000,
    });
    expect(
      extractProperty(page({ "@type": "Offer", price: 300000, priceCurrency: "USD" })),
    ).toEqual({});
  });

  it("ignores malformed JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json</script>`;
    expect(extractProperty(html)).toEqual({});
  });
});

describe("toNumber", () => {
  it("handles Portuguese and English number formats", () => {
    expect(toNumber("250 000 €")).toBe(250_000);
    expect(toNumber("250.000")).toBe(250_000);
    expect(toNumber("1.250.000")).toBe(1_250_000);
    expect(toNumber("250.000,50")).toBe(250_000.5);
    expect(toNumber("250,000.50")).toBe(250_000.5);
    expect(toNumber("72.5")).toBe(72.5);
    expect(toNumber("0.035")).toBe(0.035);
    expect(toNumber("abc")).toBeUndefined();
  });
});
