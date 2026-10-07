import {
  cacheGet,
  cacheSet,
  clientIp,
  createAnalysis,
  findAreaByNames,
  findAreaByPoint,
  rateLimit,
} from "@olhovivo/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { aiExtractProperty, aiReaderEnabled, NotAListingError } from "@/lib/linkReader/aiExtract";
import { extractProperty, type ExtractedProperty } from "@/lib/linkReader/extract";
import { fetchListing, isAllowedHost, NotAllowedError } from "@/lib/linkReader/fetchListing";
import { getCurrentUser } from "@/lib/session";

export type AnalyzeResponse =
  | { status: "ok"; analysisId: string; property: ExtractedProperty; areaId: number | null }
  | { status: "not_allowed" | "failed" | "invalid" | "rate_limited" | "not_listing" };

/** Per IP: each request may fetch a page from another site on the user's behalf. */
const LIMIT = { requests: 20, windowSeconds: 600 };

/**
 * Link analysis (WBS 6.2.2): reads one listing page from an allow-listed site, extracts the
 * property data (with Claude when configured, otherwise from structured metadata) and locates it. The analysis is stored so it can later be linked to an account.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(
    getDb(),
    `analyze:${clientIp(request.headers)}`,
    LIMIT.requests,
    LIMIT.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json<AnalyzeResponse>(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
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
    const key = `listing:v4:${url.href}`;
    let property = cacheGet<ExtractedProperty>(db, key);
    if (!property) {
      property = await readListing(url.href);
      cacheSet(db, key, property, 24 * 3600);
    }
    const area =
      (property.lat !== undefined && property.lng !== undefined
        ? findAreaByPoint(db, property.lat, property.lng)
        : undefined) ??
      (property.municipality
        ? findAreaByNames(db, property.municipality, property.parish ? [property.parish] : [])
        : undefined);
    const analysis = createAnalysis(db, {
      url: url.href,
      extracted: property,
      property,
      areaId: area?.id,
      userId: (await getCurrentUser())?.id,
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
    if (error instanceof NotAListingError) {
      return NextResponse.json<AnalyzeResponse>({ status: "not_listing" });
    }
    console.error("analyze failed", error);
    return NextResponse.json<AnalyzeResponse>({ status: "failed" }, { status: 502 });
  }
}

/** Claude reads the page when configured; structured metadata is the fallback. */
async function readListing(href: string): Promise<ExtractedProperty> {
  const html = await fetchListing(href);
  if (!aiReaderEnabled()) return extractProperty(html);
  try {
    // Coordinates from structured data, when present, locate the property more precisely; the
    // photos only come from structured data.
    const { lat, lng, photos } = extractProperty(html);
    return {
      ...(await aiExtractProperty(html, href)),
      ...(lat !== undefined && { lat, lng }),
      ...(photos && { photos }),
    };
  } catch (error) {
    if (error instanceof NotAListingError) throw error;
    console.error("AI listing reader failed; using structured data", error);
    return extractProperty(html);
  }
}
