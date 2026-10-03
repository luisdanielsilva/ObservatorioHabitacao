import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "./routing";

/** Narrows the [locale] route param, 404 for anything else. */
export function asLocale(locale: string): AppLocale {
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

/** Reads the [locale] param and enables static rendering for the page. */
export async function initPageLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  return locale;
}
