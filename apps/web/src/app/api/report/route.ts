import { getScenario } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reportLocale } from "@/lib/report/locale";
import {
  pdfResponse,
  renderScenarioPdf,
  reportFilename,
  sourceFromState,
} from "@/lib/report/render";
import { readReportRequest } from "@/lib/report/request";
import { getMember } from "@/lib/session";

/**
 * The PDF report of the evaluation on screen, without saving it (issue #12): for everyone,
 * clean when signed in and with a watermark otherwise. Downloaded as a file.
 */
export async function POST(request: Request) {
  const user = await getMember();
  const read = await readReportRequest(request, user);
  if ("response" in read) return read.response;
  const { name, state, savedId } = read.body;

  const saved = user && savedId ? getScenario(getDb(), savedId, user.id) : undefined;
  const source = sourceFromState(
    { name, state },
    saved ? { id: saved.id, userId: user!.id } : null,
  );
  if (!source) return NextResponse.json({ error: "no parameters" }, { status: 500 });
  const pdf = await renderScenarioPdf(source, reportLocale(request), {
    photos: true,
    author: user,
  });
  if (!pdf) return NextResponse.json({ error: "cannot calculate" }, { status: 422 });
  return pdfResponse(pdf, reportFilename(source.name), "attachment");
}
