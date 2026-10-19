import { getSharedScenario } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, renderScenarioPdf, reportFilename } from "@/lib/report/render";
import { getMember } from "@/lib/session";

/**
 * PDF report of a shared scenario, for anyone with the link; photos only if the owner chose.
 * It names the person who downloads it when signed in, never the owner.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/partilha/[token]/pdf">) {
  const scenario = getSharedScenario(getDb(), (await params).token);
  if (!scenario) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await renderScenarioPdf(scenario, reportLocale(request), {
    photos: scenario.sharePhotos,
    author: await getMember(),
  });
  if (!pdf) return NextResponse.json({ error: "cannot calculate" }, { status: 500 });
  return pdfResponse(pdf, reportFilename(scenario.name), "inline");
}
