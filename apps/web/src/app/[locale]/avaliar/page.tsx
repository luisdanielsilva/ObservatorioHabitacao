import {
  getActiveParameterSet,
  getAreaTree,
  getLatestReferenceRate,
  getScenario,
  RENT_UPDATE_RATE,
} from "@olhovivo/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { exampleAreaId, exampleState } from "@/lib/calculator/example";
import { normaliseState } from "@/lib/calculator/state";
import { requireUser } from "@/lib/session";
import { CalculatorRoot } from "./CalculatorRoot";
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
  const locale = await initPageLocale(params);
  const t = await getTranslations("evaluate");
  const { area, cenario, rascunho, link, manual, exemplo } = await searchParams;

  const db = getDb();
  const tree = getAreaTree(db);
  const parameterSet = getActiveParameterSet(db, "continente", new Date().getFullYear());
  const euribor = getLatestReferenceRate(db, "euribor_12m");
  const rentUpdate = getLatestReferenceRate(db, RENT_UPDATE_RATE);
  const requestedArea = Number(Array.isArray(area) ? area[0] : area);
  // A listing link from the home page is read as soon as the page opens.
  const requestedLink = (Array.isArray(link) ? link[0] : link)?.trim().slice(0, 2000) || null;

  // A saved scenario, only for its owner.
  const scenarioId = Number(Array.isArray(cenario) ? cenario[0] : cenario);
  let initial;
  if (Number.isInteger(scenarioId) && scenarioId > 0) {
    const user = await requireUser(locale, `/avaliar?cenario=${scenarioId}`);
    const saved = getScenario(db, scenarioId, user.id);
    if (saved) {
      initial = {
        state: normaliseState(saved.inputs),
        savedId: saved.id,
        name: saved.name,
        shareToken: saved.shareToken,
      };
    }
  }

  // Development only: a complete example, to check the layout without typing it all in.
  const devTools = process.env.NODE_ENV === "development";
  if (devTools && !initial && exemplo !== undefined) {
    initial = { state: exampleState(exampleAreaId(tree)), savedId: null, name: null };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader title={t("title")} intro={t("intro")} />
      <CalculatorRoot
        key={initial?.savedId ?? (exemplo !== undefined ? "example" : "new")}
        initial={initial}
        // The evaluation in progress comes back, except for a saved scenario or a new link.
        restoreDraft={!initial && !requestedLink}
        autoSave={!initial && rascunho !== undefined}
        tree={tree}
        params={parameterSet?.data ?? null}
        euribor12m={euribor ? { value: euribor.value, date: euribor.date } : null}
        rentUpdate={rentUpdate ?? null}
        initialAreaId={Number.isInteger(requestedArea) && requestedArea > 0 ? requestedArea : null}
        initialLink={initial ? null : requestedLink}
        startManual={manual !== undefined}
        devTools={devTools}
      />
    </div>
  );
}
