/**
 * Parts of the site switched on or off. A dormant section keeps its code, but nothing links to
 * it, it is left out of the sitemap and its pages and API answer 404. "Preços" is dormant.
 */
export const FEATURES = {
  /** /vender: the seller's valuation (what the property is worth, what the seller keeps). */
  sell: true,
  /** /precos and /api/prices: median sale and rent prices per area. */
  prices: false,
} as const;
