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

describe("extractProperty with embedded listing data (Imovirtual)", () => {
  // Trimmed from a real Imovirtual listing page (T1 in Braga).
  const ad = {
    title: "T1 Novos com Varanda em Braga perto da CP com boas áreas",
    target: {
      Area: "70",
      Price: 260000,
      ProperType: "apartamento",
      MarketType: "primary",
      Rooms_num: ["2"],
      Extras_types: ["balcony", "lift", "air_conditioning"],
    },
    location: {
      coordinates: { latitude: 41.54579, longitude: -8.432778 },
      reverseGeocoding: {
        locations: [
          { locationLevel: "district", name: "Braga" },
          { locationLevel: "council", name: "Braga" },
          { locationLevel: "parish", name: "Braga (Maximinos, Sé e Cividade)" },
        ],
      },
    },
    images: [
      {
        medium: "https://ireland.apollo.olxcdn.com/v1/files/a/image;s=655x491",
        large: "https://ireland.apollo.olxcdn.com/v1/files/a/image;s=2048x1536",
      },
      { large: "https://ireland.apollo.olxcdn.com/v1/files/b/image;s=2048x1536" },
      { large: "https://evil.example.com/c.jpg" },
      { large: "http://ireland.apollo.olxcdn.com/v1/files/d/image" },
    ],
  };
  const html = `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad } } })}</script></head></html>`;

  it("reads price, area, type, typology, condition, extras and location", () => {
    const p = extractProperty(html);
    expect(p).toMatchObject({
      askingPrice: 260_000,
      areaM2: 70,
      propertyType: "apartamento",
      // From the title: Rooms_num counts the living room too.
      bedrooms: 1,
      condition: "novo",
      hasElevator: true,
      hasBalcony: true,
      lat: 41.54579,
      lng: -8.432778,
      district: "Braga",
      municipality: "Braga",
      parish: "Braga (Maximinos, Sé e Cividade)",
    });
  });

  it("keeps the photos on the listing's image server only, large size, main first", () => {
    expect(extractProperty(html).photos).toEqual([
      "https://ireland.apollo.olxcdn.com/v1/files/a/image;s=2048x1536",
      "https://ireland.apollo.olxcdn.com/v1/files/b/image;s=2048x1536",
    ]);
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
