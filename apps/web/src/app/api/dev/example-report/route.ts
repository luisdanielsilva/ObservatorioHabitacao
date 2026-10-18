import {
  getActiveParameterSet,
  getAreaBreadcrumb,
  getAreaTree,
  type ScenarioRow,
} from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { exampleAreaId, exampleState } from "@/lib/calculator/example";
import { getDb } from "@/lib/db";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, renderScenarioPdf } from "@/lib/report/render";

/**
 * Development only: the PDF report of the example (/avaliar?exemplo=1, the T1 in Braga), made
 * without saving it, with the listing's photos. scripts/report-preview.mjs turns it into the
 * home page's report preview (issue #9). Not found in production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const db = getDb();
  const locale = reportLocale(request);
  const state = exampleState(exampleAreaId(getAreaTree(db)));
  const params = getActiveParameterSet(db, "continente", new Date().getFullYear());
  if (!params) return NextResponse.json({ error: "no parameters" }, { status: 500 });

  // Named as the calculator names it, e.g. "Apartamento T1 em Braga (Maximinos, Sé e Cividade)".
  const t = await getTranslations({ locale, namespace: "evaluate" });
  const area = state.areaId ? getAreaBreadcrumb(db, state.areaId).at(-1)?.name : undefined;
  const type = `${t("types.apartamento")} T${state.bedrooms}`;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const scenario = {
    id: 0,
    userId: "",
    name: area ? t("defaultName", { type, area }) : type,
    inputs: state as unknown as Record<string, unknown>,
    parameterSetId: params.id,
    createdAt: now,
    updatedAt: now,
  } as ScenarioRow;

  const pdf = await renderScenarioPdf(scenario, locale, { photos: true });
  if (!pdf) return NextResponse.json({ error: "cannot calculate" }, { status: 500 });
  return pdfResponse(pdf, "relatorio-exemplo.pdf", "inline");
}
