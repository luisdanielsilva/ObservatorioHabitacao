import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/i18n/locale";

type TitleKey = "nav.dashboard" | "params.title" | "leads.title" | "imports.title" | "users.title";

/** Localised, non-indexed metadata for back-office pages. */
export async function adminMetadata(
  params: Promise<{ locale: string }>,
  titleKey: TitleKey,
): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "admin" });
  return { title: `${t(titleKey)} · ${t("title")}`, robots: { index: false, follow: false } };
}
