import { classifyOpportunity, type Opportunity } from "@observatorio-habitacao/engine";
import { distanceKm, googleMapsUrl, pointFromMapsUrl } from "../mapsLink";
import { MIN_COMPARABLES, type CalculatorState, type Comparable } from "./state";

/** What sets a similar listing apart from the property, when it is known for both. */
export type ComparableDifference = "type" | "bedrooms" | "area" | "condition";

/** A similar listing as compared with the property. */
export interface ComparableRow {
  comparable: Comparable;
  pricePerM2: number | null;
  /** The property's €/m² against this listing's: −0.1 means the property is 10 % cheaper. */
  difference: number | null;
  /** In a straight line, when both places are known from their Google Maps links. */
  distanceKm: number | null;
  differences: ComparableDifference[];
  /** The listing's link and its Google Maps link, when they are safe to open. */
  listingUrl: string | null;
  mapsUrl: string | null;
}

export interface ComparablesSummary {
  rows: ComparableRow[];
  /** Listings with a price per m² (asking price and area). */
  count: number;
  /** Fewer than MIN_COMPARABLES listings with a price per m². */
  tooFew: boolean;
  medianPerM2: number | null;
  minPerM2: number | null;
  maxPerM2: number | null;
  medianPrice: number | null;
  /** The property's own asking price per m². */
  pricePerM2: number | null;
  /** The property against the median €/m², with the same thresholds as the market value. */
  opportunity: Opportunity | null;
  /** The property's area at the similar listings' median €/m². */
  valueAtMedian: number | null;
  /** How many similar listings ask more per m² than the property. */
  dearer: number;
}

/** An area that differs by more than this share counts as different. */
const AREA_TOLERANCE = 0.25;

/** What the comparison reads from the property: Avaliar anúncio's state or a seller's property. */
export type ComparableSubject = Pick<
  CalculatorState,
  "askingPrice" | "areaM2" | "mapsUrl" | "propertyType" | "bedrooms" | "condition" | "comparables"
>;

export function compareListings(state: ComparableSubject): ComparablesSummary {
  const pricePerM2 = perM2(state.askingPrice, state.areaM2);
  const home = pointFromMapsUrl(state.mapsUrl);
  const rows = state.comparables.map((c): ComparableRow => {
    const own = perM2(c.askingPrice, c.areaM2);
    const point = pointFromMapsUrl(c.mapsUrl);
    const differences: ComparableDifference[] = [];
    if (c.propertyType !== state.propertyType) differences.push("type");
    if (c.bedrooms !== null && state.bedrooms !== null && c.bedrooms !== state.bedrooms) {
      differences.push("bedrooms");
    }
    if (
      c.areaM2 !== null &&
      state.areaM2 &&
      Math.abs(c.areaM2 / state.areaM2 - 1) > AREA_TOLERANCE
    ) {
      differences.push("area");
    }
    if (c.condition !== null && c.condition !== state.condition) differences.push("condition");
    return {
      comparable: c,
      pricePerM2: own,
      difference: own && pricePerM2 ? pricePerM2 / own - 1 : null,
      distanceKm: home && point ? distanceKm(home, point) : null,
      differences,
      listingUrl: webUrl(c.url),
      mapsUrl: googleMapsUrl(c.mapsUrl),
    };
  });

  const values = rows.flatMap((r) => (r.pricePerM2 === null ? [] : [r.pricePerM2]));
  const prices = state.comparables.flatMap((c) => (c.askingPrice === null ? [] : [c.askingPrice]));
  const medianPerM2 = median(values);
  return {
    rows,
    count: values.length,
    tooFew: values.length < MIN_COMPARABLES,
    medianPerM2,
    minPerM2: values.length ? Math.min(...values) : null,
    maxPerM2: values.length ? Math.max(...values) : null,
    medianPrice: median(prices),
    pricePerM2,
    opportunity:
      pricePerM2 !== null && medianPerM2 !== null
        ? classifyOpportunity(pricePerM2, medianPerM2)
        : null,
    valueAtMedian: medianPerM2 !== null && state.areaM2 ? medianPerM2 * state.areaM2 : null,
    dearer: pricePerM2 === null ? 0 : values.filter((v) => v > pricePerM2).length,
  };
}

function perM2(price: number | null, area: number | null): number | null {
  return price && area ? price / area : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The link when it is a web address, otherwise null (it becomes a clickable link). */
export function webUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** The site's name for a listing link, e.g. "imovirtual.com". */
export const siteName = (href: string) => new URL(href).hostname.replace(/^www\./, "");
