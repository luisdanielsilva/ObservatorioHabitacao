import type { PropertyData } from "@olhovivo/db";
import type { Condition, PropertyType } from "@/lib/calculator/state";
import { listingPhotos } from "../listingPhotos";

/**
 * Extracts property data from a listing page's HTML, using only structured data: schema.org
 * JSON-LD, Open Graph tags, and the listing JSON that Next.js sites such as Imovirtual embed for
 * their own page. The visible page is not scraped; the link reader only runs for allowed sites.
 */
export interface ExtractedProperty extends Omit<PropertyData, "propertyType" | "condition"> {
  propertyType?: PropertyType;
  condition?: Condition;
  /** Location names as written on the page, used when there are no coordinates. */
  district?: string;
  municipality?: string;
  parish?: string;
  /** The listing's photos (addresses on its image server), main photo first. */
  photos?: string[];
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

  readNextDataAd(html, result);
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

/**
 * Imovirtual (and other sites built the same way) embed the listing as JSON for their own page
 * (`__NEXT_DATA__` → props.pageProps.ad): area, condition, location and photos that the
 * schema.org data lacks. Only fills what is still missing.
 */
function readNextDataAd(html: string, result: ExtractedProperty) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return;
  let ad: Json | undefined;
  try {
    const data = JSON.parse(match[1]!) as Json;
    ad = ((data.props as Json | undefined)?.pageProps as Json | undefined)?.ad as Json | undefined;
  } catch {
    return;
  }
  if (!ad || typeof ad !== "object") return;
  const target = (ad.target ?? {}) as Json;

  result.title ??= typeof ad.title === "string" ? ad.title : undefined;
  result.askingPrice ??= toNumber(target.Price);
  result.areaM2 ??= toNumber(target.Area);
  result.propertyType ??= propertyTypeFrom([String(target.ProperType ?? "")]);
  if (target.MarketType === "primary") result.condition ??= "novo";
  const extras = asArray(target.Extras_types).map(String);
  if (extras.length) {
    result.hasElevator ??= extras.includes("lift") || undefined;
    result.hasBalcony ??= extras.includes("balcony") || undefined;
    result.hasGarage ??= extras.some((e) => /garage|parking/.test(e)) || undefined;
    result.hasPool ??= extras.includes("pool") || undefined;
  }

  const location = (ad.location ?? {}) as Json;
  const coordinates = location.coordinates as Json | undefined;
  const lat = toNumber(coordinates?.latitude);
  const lng = toNumber(coordinates?.longitude);
  if (result.lat === undefined && lat !== undefined && lng !== undefined) {
    Object.assign(result, { lat, lng });
  }
  const levels = asArray((location.reverseGeocoding as Json | undefined)?.locations) as Json[];
  const named = (level: string) => {
    const name = levels.find((l) => l.locationLevel === level)?.name;
    return typeof name === "string" ? name : undefined;
  };
  result.district ??= named("district");
  result.municipality ??= named("council");
  result.parish ??= named("parish");

  if (!result.photos) {
    const photos = listingPhotos(
      asArray(ad.images).map((img) => (img as Json).large ?? (img as Json).medium),
    );
    if (photos.length) result.photos = photos;
  }
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
