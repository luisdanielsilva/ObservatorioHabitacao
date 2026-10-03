import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyntheticBadge } from "@/components/shared/SyntheticBadge";
import { getOverviewRows } from "@/components/prices/data";
import { PriceTable } from "@/components/prices/PriceTable";
import { alternatesFor } from "@/lib/urls";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";

// Regenerated at most once a day; imports refresh the data far less often.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/precos">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "prices" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: alternatesFor(locale, "/precos"),
  };
}

export default async function PricesPage({ params }: PageProps<"/[locale]/precos">) {
  await initPageLocale(params);
  const t = await getTranslations("prices");
  const common = await getTranslations("common");
  const rows = getOverviewRows(getDb());
  const synthetic = rows.some((r) => r.synthetic);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader title={t("title")} intro={t("intro")}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {synthetic ? <SyntheticBadge /> : <span>{common("source", { source: "INE" })}</span>}
        </div>
      </PageHeader>

      <h2 className="mb-3 text-lg font-semibold">{t("allRegions")}</h2>
      <Card className="py-0">
        <CardContent className="px-0 sm:px-2">
          <PriceTable rows={rows} caption={t("allRegions")} />
        </CardContent>
      </Card>
      {!synthetic && <p className="mt-3 text-xs text-muted-foreground">{t("overviewNote")}</p>}

      <Disclaimer className="mt-8" />
    </div>
  );
}
