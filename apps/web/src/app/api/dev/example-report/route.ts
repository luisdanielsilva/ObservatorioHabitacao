import { getAreaBreadcrumb, getAreaTree } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { exampleAreaId, exampleState } from "@/lib/calculator/example";
import { getDb } from "@/lib/db";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, renderScenarioPdf, sourceFromState } from "@/lib/report/render";

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

  // Named as the calculator names it, e.g. "Apartamento T1 em Braga (Maximinos, Sé e Cividade)".
  const t = await getTranslations({ locale, namespace: "evaluate" });
  const area = state.areaId ? getAreaBreadcrumb(db, state.areaId).at(-1)?.name : undefined;
  const type = `${t("types.apartamento")} T${state.bedrooms}`;
  const scenario = sourceFromState({ name: area ? t("defaultName", { type, area }) : type, state });
  if (!scenario) return NextResponse.json({ error: "no parameters" }, { status: 500 });

  // The home page's example: no watermark, though nobody is signed in.
  const pdf = await renderScenarioPdf(scenario, locale, { photos: true, watermark: false });
  if (!pdf) return NextResponse.json({ error: "cannot calculate" }, { status: 500 });
  return pdfResponse(pdf, "relatorio-exemplo.pdf", "inline");
}
