import { getAreaTree } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { SalesSupportForm } from "./SalesSupportForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/vender">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "sell" });
  return { title: t("title"), description: t("intro") };
}

export default async function SellPage({ params }: PageProps<"/[locale]/vender">) {
  if (!FEATURES.sell) notFound();
  await initPageLocale(params);
  const t = await getTranslations("sell");
  const tree = getAreaTree(getDb());

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={t("title")} intro={t("intro")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesSupportForm tree={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
