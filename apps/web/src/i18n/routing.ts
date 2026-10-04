import { defineRouting } from "next-intl/routing";

/**
 * Portuguese at the root (/precos), English under /en (/en/precos). The browser language is
 * not used: everyone starts in Portuguese and switches to English with the language toggle.
 */
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
