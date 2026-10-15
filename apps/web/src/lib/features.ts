/**
 * Parts of the site switched on or off. While the product focuses on evaluating a listing
 * (/avaliar), "Vender" and "Preços" are dormant: their code stays, but nothing links to them,
 * they are left out of the sitemap and their pages, form and API answer 404.
 */
export const FEATURES = {
  /** /vender: the request for help selling a property. */
  sell: false,
  /** /precos and /api/prices: median sale and rent prices per area. */
  prices: false,
} as const;
