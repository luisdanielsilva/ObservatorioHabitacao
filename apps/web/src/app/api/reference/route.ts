import {
  getAreaBreadcrumb,
  getImiRate,
  getMarketReference,
  getMarketSeries,
} from "@observatorio-habitacao/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export type ReferenceResponse = {
  breadcrumb: { id: number; name: string; path: string }[];
  sale: ReturnType<typeof getMarketReference> | null;
  rent: ReturnType<typeof getMarketReference> | null;
  imi: ReturnType<typeof getImiRate> | null;
  /** The sale median over the last two years, for the area `sale` comes from (Vender's trend). */
  saleSeries: { period: string; value: number }[];
};

const SERIES_POINTS = 9;

/** Market reference for the calculator: INE medians and the IMI rate of an area. */
export function GET(request: NextRequest) {
  const areaId = Number(request.nextUrl.searchParams.get("areaId"));
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return NextResponse.json({ error: "areaId must be a positive integer" }, { status: 400 });
  }
  const db = getDb();
  const breadcrumb = getAreaBreadcrumb(db, areaId);
  if (breadcrumb.length === 0) {
    return NextResponse.json({ error: "area not found" }, { status: 404 });
  }
  const sale = getMarketReference(db, areaId, "sale_eur_m2_median") ?? null;
  const body: ReferenceResponse = {
    breadcrumb,
    sale,
    saleSeries: sale
      ? getMarketSeries(db, sale.areaId, "sale_eur_m2_median")
          .slice(-SERIES_POINTS)
          .map(({ period, value }) => ({ period, value }))
      : [],
    rent: getMarketReference(db, areaId, "rent_eur_m2_median") ?? null,
    imi: getImiRate(db, areaId, new Date().getFullYear()) ?? null,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
