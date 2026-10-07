/**
 * Photos of a listing, as addresses on the listing site's image server (read with the link).
 * Only https addresses on known image hosts are kept: the server fetches them for the owner's
 * PDF report, so they must never point anywhere else.
 */
export const LISTING_PHOTO_HOSTS = ["olxcdn.com"];

/** Enough for the PDF report (a main photo and five smaller) and a few spare. */
export const MAX_LISTING_PHOTOS = 12;

export function isListingPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.port &&
      LISTING_PHOTO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

/** Valid, distinct listing photo addresses, at most MAX_LISTING_PHOTOS. */
export function listingPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isListingPhotoUrl))].slice(0, MAX_LISTING_PHOTOS);
}
