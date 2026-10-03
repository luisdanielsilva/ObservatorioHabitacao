import { getActiveParameterSet, getAreaTree, getLatestReferenceRate } from "@olhovivo/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Calculator } from "@/components/calculator/Calculator";
import { PageHeader } from "@/components/shared/PageHeader";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/avaliar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "evaluate" });
  return { title: t("title"), description: t("intro") };
}

export default async function EvaluatePage({
  params,
  searchParams,
}: PageProps<"/[locale]/avaliar">) {
  await initPageLocale(params);
  const t = await getTranslations("evaluate");
  const { area } = await searchParams;

  const db = getDb();
  const tree = getAreaTree(db);
  const parameterSet = getActiveParameterSet(db, "continente", new Date().getFullYear());
  const euribor = getLatestReferenceRate(db, "euribor_12m");
  const requestedArea = Number(Array.isArray(area) ? area[0] : area);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader title={t("title")} intro={t("intro")} />
      <Calculator
        tree={tree}
        params={parameterSet?.data ?? null}
        euribor12m={euribor ? { value: euribor.value, date: euribor.date } : null}
        initialAreaId={Number.isInteger(requestedArea) && requestedArea > 0 ? requestedArea : null}
      />
    </div>
  );
}
