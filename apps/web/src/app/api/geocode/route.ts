import { clientIp, rateLimit } from "@olhovivo/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { areaForPoint, geocode } from "@/lib/geocode";

export type GeocodeResponse =
  | { status: "ok"; lat: number; lng: number; areaId: number | null; areaName: string | null }
  | { status: "not_found" | "invalid" | "failed" | "rate_limited" };

/** Per IP: address searches hit OpenStreetMap's free service, which allows little traffic. */
const LIMIT = { requests: 30, windowSeconds: 600 };

/** Finds an address and the freguesia/concelho it belongs to (WBS 4.3.3). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 4 || q.length > 200) {
    return NextResponse.json<GeocodeResponse>({ status: "invalid" }, { status: 400 });
  }
  const db = getDb();
  const limit = rateLimit(
    db,
    `geocode:${clientIp(request.headers)}`,
    LIMIT.requests,
    LIMIT.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json<GeocodeResponse>(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  try {
    const point = await geocode(db, q);
    if (!point) return NextResponse.json<GeocodeResponse>({ status: "not_found" }, { status: 404 });
    const area = areaForPoint(db, point);
    return NextResponse.json<GeocodeResponse>({
      status: "ok",
      lat: point.lat,
      lng: point.lng,
      areaId: area?.id ?? null,
      areaName: area?.name ?? null,
    });
  } catch (error) {
    console.error("geocode failed", error);
    return NextResponse.json<GeocodeResponse>({ status: "failed" }, { status: 502 });
  }
}
