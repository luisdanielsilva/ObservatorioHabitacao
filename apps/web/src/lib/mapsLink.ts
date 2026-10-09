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
