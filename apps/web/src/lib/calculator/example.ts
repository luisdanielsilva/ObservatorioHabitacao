import type { AreaTree } from "@/components/shared/AreaPicker";
import { mapsUrlForPoint } from "../mapsLink";
import { emptyComparable, initialState, type CalculatorState, type Comparable } from "./state";

/** The listing the example comes from (Imovirtual, read on 2026-10-07). */
const LISTING_URL =
  "https://www.imovirtual.com/pt/anuncio/t1-novos-com-varanda-em-braga-perto-da-cp-com-boas-areas-ID1iWvE";

/** Its photos, main first, as the link reader returned them. */
const LISTING_PHOTOS = [
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6ImtkZ202OG5vN21obDItQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.ogTmFpxqPSHWZNiS-k8-utBHFwNNaDYMmmZGbXfMlnM/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6IjkybGN4aHpyanR3ZDMtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.K6idNzik9_2vMqj2g_sBXJyi9NTv-ihFCUqcMM1YW4g/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6IjdkOGkzYzd3MDIxaTEtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.Mr9-HO3lM9cTUPSnm358hYEzBI6v7wX4g8gK_bX4enQ/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6IjkxenVnMzN5MmZ2ZDMtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.y-eQcvmcqrmviakRBNg_Wft_68cw0jbAMGbSWjcZCz8/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6Imw5MmpoNDB0eHBtbTMtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.4--GHzRFdSFoiIMtyBBdHy_-rDPWLhdwaTGh4q_bzP4/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6Im5nNHAxN2RqcnA5NjMtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.Vb_IUqBOefZVkIqKjj14TO9IUrSNF8c94WmjT6gfpTw/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6ImpneTlmbWZmbmd1Yy1BUFQiLCJ3IjpbeyJmbiI6IjY5bmxwYTdlY3FtNzEtQVBUIiwicyI6IjE2IiwiYSI6IjAiLCJwIjoiMTAsLTEwIn1dfQ.6O4xbjvzX93K_vIeTfCXFtbJsFN10TmXPZEsvgIBDwY/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6IjFoMzJ3amZtYzBsZS1BUFQiLCJ3IjpbeyJmbiI6IjY5bmxwYTdlY3FtNzEtQVBUIiwicyI6IjE2IiwiYSI6IjAiLCJwIjoiMTAsLTEwIn1dfQ.6Rx3D93QbNdEPetjvI8pmCq0f-1cHOjy5Zwy9tPBDVU/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6Im45YTA2cXFseDczcC1BUFQiLCJ3IjpbeyJmbiI6IjY5bmxwYTdlY3FtNzEtQVBUIiwicyI6IjE2IiwiYSI6IjAiLCJwIjoiMTAsLTEwIn1dfQ.YQzMnzchPUGzmYW-CVPnVspMct1h35ZqDe0jeRC7fQM/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6ImN4MzRwbDRuczl5OTEtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.kjD39hFKMhuGYp89uscqrW-qvrgS_VvSuaUludPNx-w/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6Ind5eW1xNXF2ZnZueC1BUFQiLCJ3IjpbeyJmbiI6IjY5bmxwYTdlY3FtNzEtQVBUIiwicyI6IjE2IiwiYSI6IjAiLCJwIjoiMTAsLTEwIn1dfQ.1WeGac6tjQJUhgbUibIZzBAGZ1Z-YeqLEETd_kvUTmk/image;s=2048x1536;q=80",
  "https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6InZ6Ynptc3J5ZHN6djMtQVBUIiwidyI6W3siZm4iOiI2OW5scGE3ZWNxbTcxLUFQVCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.PTH7bW8EPPsXBYre5q2sxtP5AHnpEoGKSo8fy8Lgen0/image;s=2048x1536;q=80",
];

/**
 * A complete evaluation for checking the layout without typing it in (development only:
 * /avaliar?exemplo=1). The property is a real listing: a new T1 of 70 m² in Braga asking
 * 260 000 €, with its photos; the market values, rents and deal figures are the example's own.
 * Bought with a loan, resold after 6 months, and all four deals filled in.
 */
export function exampleState(areaId: number | null): CalculatorState {
  return initialState({
    areaId,
    url: LISTING_URL,
    listingPhotos: LISTING_PHOTOS,
    // The listing's coordinates, as the link reader fills them in.
    mapsUrl: mapsUrlForPoint(41.54579, -8.432778),
    propertyType: "apartamento",
    bedrooms: 1,
    areaM2: 70,
    condition: "novo",
    askingPrice: 260_000,
    extras: { garage: false, elevator: true, balcony: true, pool: false },
    deals: ["flip", "longTermRental", "shortTermRental", "contractAssignment"],
    marketValue: 275_000,
    resaleValue: 320_000,
    monthlyRent: 950,
    nightlyRate: { high: 95, mid: 75, low: 55 },
    occupancy: { high: 0.85, mid: 0.65, low: 0.45 },
    deposit: 26_000,
    assignmentPrice: 40_000,
    useLoan: true,
    flipMonths: 6,
    comparables: exampleComparables(),
  });
}

/**
 * Similar listings for the example, typed in by hand: invented figures near the property, with
 * no listing links (one is a T2, to show a listing that differs).
 */
const EXAMPLE_COMPARABLES = [
  {
    bedrooms: 1,
    areaM2: 65,
    condition: "novo",
    askingPrice: 249_000,
    at: [41.5491, -8.4302],
    location: "Braga (São Vicente), Braga",
  },
  {
    bedrooms: 1,
    areaM2: 74,
    condition: "novo",
    askingPrice: 285_000,
    at: [41.5432, -8.4361],
    location: "Braga (Maximinos, Sé e Cividade), Braga",
  },
  {
    bedrooms: 1,
    areaM2: 68,
    condition: "usado",
    askingPrice: 215_000,
    at: [41.5517, -8.4215],
    location: "Braga (São Víctor), Braga",
  },
  {
    bedrooms: 2,
    areaM2: 92,
    condition: "novo",
    askingPrice: 335_000,
    at: [41.5389, -8.4402],
    location: "Braga (Maximinos, Sé e Cividade), Braga",
  },
] as const satisfies readonly (Partial<Comparable> & { at: readonly [number, number] })[];

function exampleComparables(): Comparable[] {
  return EXAMPLE_COMPARABLES.map(({ at, ...c }) =>
    emptyComparable({ ...c, mapsUrl: mapsUrlForPoint(at[0], at[1]) }),
  );
}

/** The listing's parish (Braga, Maximinos, Sé e Cividade), or else the first parish there is. */
export function exampleAreaId(tree: AreaTree): number | null {
  const find = (list: AreaTree, name: string) => list.find((n) => n.name === name);
  const braga = find(find(tree, "Braga")?.children ?? [], "Braga");
  const parish = find(braga?.children ?? [], "Braga (Maximinos, Sé e Cividade)");
  return (parish ?? tree[0]?.children[0]?.children[0])?.id ?? null;
}
