import { getScenario } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, renderScenarioPdf, reportFilename } from "@/lib/report/render";
import { getMember } from "@/lib/session";

/** PDF report of a saved scenario, with its photos, for its owner (WBS 6.3.3). */
export async function GET(request: Request, { params }: RouteContext<"/api/scenarios/[id]/pdf">) {
  const user = await getMember();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!entitlementsFor(user.plan).pdfReports) {
    return NextResponse.json({ error: "not included in your plan" }, { status: 403 });
  }
  const id = Number((await params).id);
  const scenario = Number.isInteger(id) ? getScenario(getDb(), id, user.id) : undefined;
  if (!scenario) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pdf = await renderScenarioPdf(scenario, reportLocale(request), { photos: true });
  if (!pdf) return NextResponse.json({ error: "cannot calculate" }, { status: 500 });
  // Shown in the browser (Ver PDF opens it in a new tab); links with "download" still save it.
  return pdfResponse(pdf, reportFilename(scenario.name), "inline");
}
