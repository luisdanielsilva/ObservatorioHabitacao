import { getAreaTree } from "@olhovivo/db";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/areas → district → municipality → parish tree, for location pickers. */
export function GET() {
  return NextResponse.json(getAreaTree(getDb()), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
