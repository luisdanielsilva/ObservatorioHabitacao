import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { SimplePage } from "@/components/pages/SimplePage";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/entrar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "signIn" });
  return { title: t("title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/entrar">) {
  await initPageLocale(params);
  const t = await getTranslations("signIn");
  const common = await getTranslations("common");
  const nav = await getTranslations("nav");
  return (
    <SimplePage title={t("title")} text={t("text")} note={common("comingSoon")}>
      <Button asChild className="mt-8">
        <Link href="/avaliar">{nav("evaluate")}</Link>
      </Button>
    </SimplePage>
  );
}
