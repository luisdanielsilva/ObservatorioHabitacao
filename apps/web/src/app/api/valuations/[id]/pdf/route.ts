import { getValuation } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { FEATURES } from "@/lib/features";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, reportFilename } from "@/lib/report/render";
import { renderValuationPdf } from "@/lib/report/valuation";
import { getMember } from "@/lib/session";

/** PDF report of a saved seller valuation (Vender), for its owner. */
export async function GET(request: Request, { params }: RouteContext<"/api/valuations/[id]/pdf">) {
  if (!FEATURES.sell) return NextResponse.json({ error: "not found" }, { status: 404 });
  const user = await getMember();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!entitlementsFor(user.plan).pdfReports) {
    return NextResponse.json({ error: "not included in your plan" }, { status: 403 });
  }
  const id = Number((await params).id);
  const valuation = Number.isInteger(id) ? getValuation(getDb(), id, user.id) : undefined;
  if (!valuation) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pdf = await renderValuationPdf(valuation, reportLocale(request), user);
  if (!pdf) return NextResponse.json({ error: "cannot value" }, { status: 500 });
  return pdfResponse(pdf, reportFilename(valuation.name || "avaliacao"), "inline");
}
