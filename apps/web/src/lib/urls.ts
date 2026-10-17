import type { AppLocale } from "@/i18n/routing";

/** Public base URL, without a trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://observatoriohabitacao.pt").replace(
    /\/$/,
    "",
  );
}

/** Absolute URL of a pathname ("/precos/lisboa") in a locale: pt has no prefix, en uses /en. */
export function localizedUrl(locale: AppLocale, pathname: string): string {
  const path = pathname === "/" ? "" : pathname;
  return `${siteUrl()}${locale === "en" ? "/en" : ""}${path}` || "/";
}

/** canonical + hreflang alternates for a pathname. */
export function alternatesFor(locale: AppLocale, pathname: string) {
  return {
    canonical: localizedUrl(locale, pathname),
    languages: {
      "pt-PT": localizedUrl("pt", pathname),
      en: localizedUrl("en", pathname),
      "x-default": localizedUrl("pt", pathname),
    },
  };
}
