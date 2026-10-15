/**
 * Google Maps links for a property's location: the user's own (shared from Google Maps) or one
 * made from the listing's coordinates. Only Google Maps addresses are accepted, so the link in
 * the PDF and on the shared page can never point anywhere else.
 */

/** The link as https when it is a Google Maps address, otherwise null. */
export function googleMapsUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.port) {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const google = /^(www\.)?google\.(com|pt|[a-z]{2}|com?\.[a-z]{2})$/.test(host);
  const valid =
    // maps.google.com/…, google.pt/maps/…
    /^maps\.google\.(com|pt|[a-z]{2}|com?\.[a-z]{2})$/.test(host) ||
    (google && (path === "/maps" || path.startsWith("/maps/"))) ||
    // Short links from "Partilhar" in the app: maps.app.goo.gl/… and goo.gl/maps/…
    (host === "maps.app.goo.gl" && path.length > 1) ||
    (host === "goo.gl" && path.startsWith("/maps/"));
  if (!valid) return null;
  url.protocol = "https:";
  return url.href;
}

/** A Google Maps link to a point (from the listing's coordinates). */
export function mapsUrlForPoint(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * The point a Google Maps link shows, when it is written in the link ("?q=41.5,-8.4",
 * "/@41.5,-8.4,17z", "/place/41.5,-8.4"); null otherwise (e.g. a maps.app.goo.gl short link).
 */
export function pointFromMapsUrl(value: string): { lat: number; lng: number } | null {
  const link = googleMapsUrl(value);
  if (!link) return null;
  const url = new URL(link);
  const pair = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  const candidates = [
    url.searchParams.get("q"),
    url.searchParams.get("query"),
    url.searchParams.get("ll"),
    decodeURIComponent(url.pathname).match(/\/@(-?[\d.]+,-?[\d.]+)/)?.[1],
    decodeURIComponent(url.pathname).match(/\/place\/(-?[\d.]+,-?[\d.]+)/)?.[1],
  ];
  for (const text of candidates) {
    const m = text?.match(pair);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

/** Distance in km between two points (haversine formula). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
