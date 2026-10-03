import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { SimplePage } from "@/components/pages/SimplePage";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contactos">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "legal" });
  return { title: t("contactsTitle") };
}

export default async function Page({ params }: PageProps<"/[locale]/contactos">) {
  await initPageLocale(params);
  const t = await getTranslations("legal");
  return <SimplePage title={t("contactsTitle")} text={t("contactsText")} note={t("draft")} />;
}
