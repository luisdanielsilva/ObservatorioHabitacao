import { getActiveParameterSet, getAreaTree, getValuation } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { requireUser } from "@/lib/session";
import { normaliseValuation } from "@/lib/valuation/state";
import { ValuationRoot } from "./ValuationRoot";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/vender">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "sell" });
  return { title: t("title"), description: t("intro") };
}

export default async function SellPage({ params, searchParams }: PageProps<"/[locale]/vender">) {
  if (!FEATURES.sell) notFound();
  const locale = await initPageLocale(params);
  const t = await getTranslations("sell");
  const { avaliacao, rascunho, area } = await searchParams;

  const db = getDb();
  const tree = getAreaTree(db);
  const parameterSet = getActiveParameterSet(db, "continente", new Date().getFullYear());
  const requestedArea = Number(Array.isArray(area) ? area[0] : area);

  // A saved valuation, only for its owner.
  const valuationId = Number(Array.isArray(avaliacao) ? avaliacao[0] : avaliacao);
  let initial;
  if (Number.isInteger(valuationId) && valuationId > 0) {
    const user = await requireUser(locale, `/vender?avaliacao=${valuationId}`);
    const saved = getValuation(db, valuationId, user.id);
    if (saved) {
      initial = {
        state: normaliseValuation(saved.input),
        savedId: saved.id,
        name: saved.name || null,
        asSaved: true,
      };
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader title={t("title")} intro={t("intro")} />
      <ValuationRoot
        key={initial?.savedId ?? "new"}
        initial={initial}
        restoreDraft={!initial}
        autoSave={!initial && rascunho !== undefined}
        tree={tree}
        params={parameterSet?.data ?? null}
        initialAreaId={Number.isInteger(requestedArea) && requestedArea > 0 ? requestedArea : null}
      />
    </div>
  );
}
