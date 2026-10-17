import { deletePhoto, getPhoto } from "@observatorio-habitacao/db";
import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { photoFilePath, removePhotoFile } from "@/lib/photos";
import { getCurrentUser } from "@/lib/session";

type Context = RouteContext<"/api/scenarios/[id]/photos/[photoId]">;

const idsOf = async (params: Context["params"]) => {
  const { id, photoId } = await params;
  const scenarioId = Number(id);
  const photo = Number(photoId);
  return Number.isInteger(scenarioId) && Number.isInteger(photo) ? { scenarioId, photo } : null;
};

/** A photo of a saved scenario, for its owner. */
export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const ids = await idsOf(params);
  const row = ids ? getPhoto(getDb(), ids.scenarioId, ids.photo, user.id) : undefined;
  if (!ids || !row) return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(photoFilePath(ids.scenarioId, row.fileName));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mimeType,
        // A photo never changes (a new one gets a new id); only its owner may see it.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const ids = await idsOf(params);
  const row = ids ? deletePhoto(getDb(), ids.scenarioId, ids.photo, user.id) : undefined;
  if (!ids || !row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await removePhotoFile(ids.scenarioId, row.fileName);
  return new NextResponse(null, { status: 204 });
}
