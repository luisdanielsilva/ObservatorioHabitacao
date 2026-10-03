import type { AppLocale } from "@/i18n/routing";

/** The report language from ?lang=pt|en, else the fallback. */
export function reportLocale(request: Request, fallback: AppLocale = "pt"): AppLocale {
  const lang = new URL(request.url).searchParams.get("lang");
  return lang === "en" || lang === "pt" ? lang : fallback;
}
