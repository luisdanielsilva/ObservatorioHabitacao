import type { PropertyData } from "@olhovivo/db";
import type { Condition, PropertyType } from "@/lib/calculator/state";

/**
 * Extracts property data from a listing page's HTML, using only structured metadata
 * (schema.org JSON-LD and Open Graph tags). Site-specific scrapers are deliberately not used:
 * the link reader only runs for sites that allow it and publish structured data.
 */
export interface ExtractedProperty extends Omit<PropertyData, "propertyType" | "condition"> {
  propertyType?: PropertyType;
  condition?: Condition;
  /** Location names as written on the page (AI reader), used when there are no coordinates. */
  district?: string;
  municipality?: string;
  parish?: string;
}

type Json = Record<string, unknown>;

export function extractProperty(html: string): ExtractedProperty {
  const nodes = jsonLdNodes(html);
  const result: ExtractedProperty = {};

  for (const node of nodes) {
    const types = asArray(node["@type"]).map(String);
    const offers = asArray(node.offers)[0] as Json | undefined;
    const price = toNumber(offers?.price ?? node.price);
    const currency = String(offers?.priceCurrency ?? node.priceCurrency ?? "EUR");
    if (price && currency === "EUR") result.askingPrice ??= price;

    const offered = (offers?.itemOffered ?? node.itemOffered ?? node.mainEntity) as
      Json | undefined;
    for (const item of [node, offered].filter(Boolean) as Json[]) {
      const itemTypes = asArray(item["@type"]).map(String);
      result.propertyType ??= propertyTypeFrom([...types, ...itemTypes]);
      result.areaM2 ??= floorSize(item.floorSize);
      // numberOfRooms counts the living room too, so it is not the typology.
      result.bedrooms ??= toNumber(item.numberOfBedrooms);
      result.address ??= addressText(item.address);
      const geo = item.geo as Json | undefined;
      if (geo && result.lat === undefined) {
        const lat = toNumber(geo.latitude);
        const lng = toNumber(geo.longitude);
        if (lat !== undefined && lng !== undefined) Object.assign(result, { lat, lng });
      }
      const amenities = asArray(item.amenityFeature).map((a) =>
        String((a as Json).name ?? "").toLowerCase(),
      );
      if (amenities.length) {
        result.hasGarage ??= amenities.some((a) => /garag|parking|estacion/.test(a)) || undefined;
        result.hasElevator ??= amenities.some((a) => /elevador|lift|elevator/.test(a)) || undefined;
        result.hasBalcony ??= amenities.some((a) => /varanda|balc/.test(a)) || undefined;
        result.hasPool ??= amenities.some((a) => /piscina|pool/.test(a)) || undefined;
      }
    }
    result.title ??= typeof node.name === "string" ? node.name : undefined;
  }

  result.title ??= metaContent(html, "og:title");
  // Portuguese titles state the typology ("T2, apartamento para comprar …").
  const typology = result.title?.match(/\bT(\d)\b/);
  if (result.bedrooms === undefined && typology) result.bedrooms = Number(typology[1]);
  if (result.askingPrice === undefined) {
    const amount = toNumber(
      metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount"),
    );
    const currency =
      metaContent(html, "product:price:currency") ??
      metaContent(html, "og:price:currency") ??
      "EUR";
    if (amount && currency === "EUR") result.askingPrice = amount;
  }
  if (result.bedrooms !== undefined) result.bedrooms = Math.min(5, Math.round(result.bedrooms));

  // Drop undefined keys so callers can spread the result.
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined));
}

function jsonLdNodes(html: string): Json[] {
  const nodes: Json[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed: unknown = JSON.parse(match[1]!.trim());
      const queue = asArray(parsed);
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const obj = item as Json;
        if (obj["@graph"]) queue.push(...asArray(obj["@graph"]));
        nodes.push(obj);
      }
    } catch {
      // Ignore malformed blocks.
    }
  }
  return nodes;
}

function propertyTypeFrom(types: string[]): PropertyType | undefined {
  const t = types.join(" ").toLowerCase();
  if (/apartment|apartamento/.test(t)) return "apartamento";
  if (/house|singlefamilyresidence|moradia/.test(t)) return "moradia";
  if (/landform|land|terreno/.test(t)) return "terreno";
  if (/store|shop|loja/.test(t)) return "loja";
  if (/office|escritorio/.test(t)) return "escritorio";
  return undefined;
}

function floorSize(value: unknown): number | undefined {
  if (value && typeof value === "object") {
    const v = value as Json;
    const unit = String(v.unitCode ?? v.unitText ?? "MTK").toUpperCase();
    if (unit === "MTK" || unit === "M2" || unit === "M²") return toNumber(v.value);
    return undefined;
  }
  return toNumber(value);
}

function addressText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (!value || typeof value !== "object") return undefined;
  const a = value as Json;
  const parts = [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion]
    .filter((p) => typeof p === "string" && p.trim())
    .map((p) => (p as string).trim());
  return parts.length ? parts.join(", ") : undefined;
}

function metaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    "i",
  );
  const m = html.match(pattern);
  const value = m?.[1] ?? m?.[2];
  return value ? decodeEntities(value) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Accepts numbers and strings such as "250 000", "250.000,50" or "250000.50". */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  let s = value.replace(/[^\d.,-]/g, "");
  if (!s) return undefined;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", "."); // 250.000,50
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, ""); // 250,000.50
  } else if (lastDot !== -1 && s.split(".").length > 2) {
    s = s.replace(/\./g, ""); // 1.250.000
  } else if (lastDot !== -1 && s.length - lastDot === 4 && !s.startsWith("0")) {
    s = s.replace(".", ""); // 250.000 (thousands separator)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
