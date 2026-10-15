import { NextResponse } from "next/server";
import { getAreaPageData } from "@/components/prices/data";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/features";

// Read from SQLite on every request; responses are small and the data changes rarely,
// so clients and proxies may cache them for an hour.
export const dynamic = "force-dynamic";

/** GET /api/prices/lisboa/cascais → medians, history and child areas for an area. */
export async function GET(_request: Request, { params }: RouteContext<"/api/prices/[...path]">) {
  if (!FEATURES.prices) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { path } = await params;
  const data = getAreaPageData(getDb(), path.map(decodeURIComponent).join("/"));
  if (!data) return NextResponse.json({ error: "area_not_found" }, { status: 404 });

  const { area, breadcrumb, prices, series, children } = data;
  return NextResponse.json(
    {
      area: { id: area.id, code: area.code, name: area.name, level: area.level, path: area.path },
      breadcrumb,
      sale: prices.sale,
      rent: prices.rent,
      grossYield: prices.grossYield,
      series,
      children,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
