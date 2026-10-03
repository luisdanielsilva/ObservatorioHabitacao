import { cacheGet, cacheSet, createAnalysis, findAreaByPoint } from "@olhovivo/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { extractProperty, type ExtractedProperty } from "@/lib/linkReader/extract";
import { fetchListing, isAllowedHost, NotAllowedError } from "@/lib/linkReader/fetchListing";

export type AnalyzeResponse =
  | { status: "ok"; analysisId: string; property: ExtractedProperty; areaId: number | null }
  | { status: "not_allowed" | "failed" | "invalid" };

/**
 * Link analysis (WBS 6.2.2): reads one listing page from an allow-listed site, extracts the
 * property data and locates it. The analysis is stored so it can later be linked to an account.
 */
export async function POST(request: NextRequest) {
  let url: URL;
  try {
    const body = (await request.json()) as { url?: unknown };
    url = new URL(String(body.url ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  } catch {
    return NextResponse.json<AnalyzeResponse>({ status: "invalid" }, { status: 400 });
  }
  if (!isAllowedHost(url.hostname)) {
    return NextResponse.json<AnalyzeResponse>({ status: "not_allowed" });
  }
  url.protocol = "https:";
  url.hash = "";

  const db = getDb();
  try {
    const key = `listing:${url.href}`;
    let property = cacheGet<ExtractedProperty>(db, key);
    if (!property) {
      property = extractProperty(await fetchListing(url.href));
      cacheSet(db, key, property, 24 * 3600);
    }
    const area =
      property.lat !== undefined && property.lng !== undefined
        ? findAreaByPoint(db, property.lat, property.lng)
        : undefined;
    const analysis = createAnalysis(db, {
      url: url.href,
      extracted: property,
      property,
      areaId: area?.id,
    });
    return NextResponse.json<AnalyzeResponse>({
      status: "ok",
      analysisId: analysis.publicId,
      property,
      areaId: area?.id ?? null,
    });
  } catch (error) {
    if (error instanceof NotAllowedError) {
      return NextResponse.json<AnalyzeResponse>({ status: "not_allowed" });
    }
    console.error("analyze failed", error);
    return NextResponse.json<AnalyzeResponse>({ status: "failed" }, { status: 502 });
  }
}
