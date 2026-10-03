import "server-only";
import {
  cacheGet,
  cacheSet,
  findAreaByNames,
  findAreaByPoint,
  type Area,
  type Db,
} from "@olhovivo/db";

/**
 * Address search with OpenStreetMap Nominatim (ODbL; attribution shown in the UI).
 * Usage policy: at most one request per second, identified User-Agent, results cached.
 * See https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "OlhoVivo/0.1 (+https://olhovivo.pt)";
const CACHE_TTL = 30 * 24 * 3600;

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Nominatim address parts, used to match areas by name when boundaries are missing. */
  parts: Record<string, string>;
}

let lastRequest = 0;

export async function geocode(db: Db, query: string): Promise<GeocodeResult | null> {
  const key = `geocode:${query.trim().toLowerCase()}`;
  const cached = cacheGet<GeocodeResult | { none: true }>(db, key);
  if (cached) return "none" in cached ? null : cached;

  const wait = lastRequest + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "pt",
    addressdetails: "1",
    limit: "1",
  }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-PT" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const [hit] = (await response.json()) as {
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }[];
  const result = hit
    ? { lat: Number(hit.lat), lng: Number(hit.lon), parts: hit.address ?? {} }
    : null;
  cacheSet(db, key, result ?? { none: true }, CACHE_TTL);
  return result;
}

/**
 * The area for a geocoded point: by CAOP boundary when boundaries are loaded, otherwise by
 * matching Nominatim's municipality and parish names against the area names.
 */
export function areaForPoint(db: Db, point: GeocodeResult): Area | undefined {
  const byBoundary = findAreaByPoint(db, point.lat, point.lng);
  if (byBoundary) return byBoundary;
  const p = point.parts;
  const municipality = p.municipality ?? p.city ?? p.town ?? p.county;
  if (!municipality) return undefined;
  const parishes = [p.suburb, p.city_district, p.quarter, p.village, p.town].filter(
    (n): n is string => !!n,
  );
  return findAreaByNames(db, municipality, parishes);
}
