import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/features";
import { reportLocale } from "@/lib/report/locale";
import { pdfResponse, reportFilename } from "@/lib/report/render";
import { readReportRequest } from "@/lib/report/request";
import { renderValuationPdf } from "@/lib/report/valuation";
import { getMember } from "@/lib/session";

/**
 * The PDF report of the seller's valuation on screen (Vender), without saving it (issue #12):
 * clean when signed in, with a watermark otherwise. Downloaded as a file.
 */
export async function POST(request: Request) {
  if (!FEATURES.sell) return NextResponse.json({ error: "not found" }, { status: 404 });
  const user = await getMember();
  const read = await readReportRequest(request, user);
  if ("response" in read) return read.response;
  const name = read.body.name.trim().slice(0, 120);

  const pdf = await renderValuationPdf(
    { name, input: (read.body.state ?? {}) as Record<string, unknown> },
    reportLocale(request),
    user,
  );
  if (!pdf) return NextResponse.json({ error: "cannot value" }, { status: 422 });
  return pdfResponse(pdf, reportFilename(name || "avaliacao"), "attachment");
}
