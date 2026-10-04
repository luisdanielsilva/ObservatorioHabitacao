import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { aiExtractProperty, NotAListingError, pageText, toProperty } = await import("./aiExtract");

const empty = {
  isListing: true,
  askingPrice: null,
  propertyType: null,
  bedrooms: null,
  areaM2: null,
  condition: null,
  district: null,
  municipality: null,
  parish: null,
  address: null,
  hasGarage: null,
  hasElevator: null,
  hasBalcony: null,
  hasPool: null,
  title: null,
};

describe("pageText", () => {
  it("keeps visible text and JSON-LD, drops scripts and styles", () => {
    const html = `<html><head><title>T2 em Arroios</title><style>.a{}</style>
      <script>track()</script>
      <script type="application/ld+json">{"price": 250000}</script></head>
      <body><h1>Apartamento&nbsp;T2</h1><p>Preço: 250 000 €</p></body></html>`;
    const text = pageText(html);
    expect(text).toContain("Title: T2 em Arroios");
    expect(text).toContain('{"price": 250000}');
    expect(text).toContain("Apartamento T2");
    expect(text).toContain("Preço: 250 000 €");
    expect(text).not.toContain("track()");
    expect(text).not.toContain(".a{}");
  });
});

describe("toProperty", () => {
  it("keeps valid values and drops empty or invalid ones", () => {
    expect(
      toProperty({
        ...empty,
        askingPrice: 250_000,
        bedrooms: 7,
        areaM2: -1,
        municipality: " Lisboa ",
        parish: "",
        hasGarage: false,
      }),
    ).toEqual({ askingPrice: 250_000, bedrooms: 5, municipality: "Lisboa", hasGarage: false });
  });
});

describe("aiExtractProperty", () => {
  const clientReturning = (response: object) =>
    ({ beta: { messages: { parse: vi.fn().mockResolvedValue(response) } } }) as never;

  it("returns the parsed listing", async () => {
    const client = clientReturning({
      stop_reason: "end_turn",
      parsed_output: { ...empty, askingPrice: 300_000, propertyType: "moradia", bedrooms: 3 },
    });
    await expect(aiExtractProperty("<p>x</p>", "https://example.pt/1", client)).resolves.toEqual({
      askingPrice: 300_000,
      propertyType: "moradia",
      bedrooms: 3,
    });
  });

  it("rejects pages that are not listings", async () => {
    const client = clientReturning({
      stop_reason: "end_turn",
      parsed_output: { ...empty, isListing: false },
    });
    await expect(aiExtractProperty("<p>x</p>", "https://example.pt/", client)).rejects.toThrow(
      NotAListingError,
    );
  });

  it("fails on a refusal", async () => {
    const client = clientReturning({ stop_reason: "refusal", parsed_output: null });
    await expect(aiExtractProperty("<p>x</p>", "https://example.pt/", client)).rejects.toThrow(
      /refused/,
    );
  });
});
