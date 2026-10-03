import { defineRouting } from "next-intl/routing";

/** Portuguese at the root (/precos), English under /en (/en/precos). */
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
