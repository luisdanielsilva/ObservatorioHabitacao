import { getSharedPhoto } from "@observatorio-habitacao/db";
import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { photoFilePath } from "@/lib/photos";

/** A photo of a shared scenario, for anyone with the link, when its owner chose to show them. */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/partilha/[token]/photos/[photoId]">,
) {
  const { token, photoId } = await params;
  const id = Number(photoId);
  const row = Number.isInteger(id) ? getSharedPhoto(getDb(), token, id) : undefined;
  if (!row) return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(photoFilePath(row.scenarioId, row.fileName));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mimeType,
        // Checked again on every view, so turning the photos or the link off takes effect at once.
        "Cache-Control": "private, no-cache",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
