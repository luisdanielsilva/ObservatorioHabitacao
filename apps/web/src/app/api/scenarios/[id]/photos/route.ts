import {
  addPhoto,
  clientIp,
  listPhotos,
  PHOTO_LIMITS,
  photoUsage,
  rateLimit,
  type PhotoRow,
} from "@observatorio-habitacao/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  InvalidImageError,
  MAX_UPLOAD_BYTES,
  processPhoto,
  removePhotoFile,
  writePhotoFile,
} from "@/lib/photos";
import { getMember } from "@/lib/session";
import { withBasePath } from "@/lib/basePath";

export interface PhotoInfo {
  id: number;
  url: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string | null;
}

export type PhotosResponse = {
  photos: PhotoInfo[];
  usage: { count: number; bytes: number };
  limits: { maxCount: number; maxBytes: number };
};

export type UploadResponse =
  | { status: "added"; photo: PhotoInfo; usage: { count: number; bytes: number } }
  | {
      status: "signin" | "not_found" | "too_many" | "too_large" | "invalid" | "rate_limited";
    };

/** Per user: each upload decodes and re-encodes an image on the server. */
const LIMIT = { requests: 120, windowSeconds: 3600 };

const info = (scenarioId: number, p: PhotoRow): PhotoInfo => ({
  id: p.id,
  url: withBasePath(`/api/scenarios/${scenarioId}/photos/${p.id}`),
  width: p.width,
  height: p.height,
  bytes: p.bytes,
  originalName: p.originalName,
});

const scenarioIdOf = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** The photos of a saved scenario, for its owner. */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/scenarios/[id]/photos">,
) {
  const user = await getMember();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const scenarioId = await scenarioIdOf(params);
  const db = getDb();
  const photos = scenarioId ? listPhotos(db, scenarioId, user.id) : undefined;
  if (!scenarioId || !photos) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json<PhotosResponse>({
    photos: photos.map((p) => info(scenarioId, p)),
    usage: photoUsage(db, scenarioId),
    limits: PHOTO_LIMITS,
  });
}

/**
 * Adds one photo (multipart field "file") to a saved scenario of the signed-in user, within
 * 30 photos and 5 MB per scenario. The image is re-encoded before it is stored.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/scenarios/[id]/photos">,
) {
  const user = await getMember();
  if (!user) return NextResponse.json<UploadResponse>({ status: "signin" }, { status: 401 });
  const scenarioId = await scenarioIdOf(params);
  if (!scenarioId)
    return NextResponse.json<UploadResponse>({ status: "not_found" }, { status: 404 });

  const db = getDb();
  const limit = rateLimit(
    db,
    `photos:${user.id}:${clientIp(request.headers)}`,
    LIMIT.requests,
    LIMIT.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json<UploadResponse>(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json<UploadResponse>({ status: "too_large" }, { status: 413 });
  }

  // Cheap checks before decoding the image.
  const usage = photoUsage(db, scenarioId);
  if (usage.count >= PHOTO_LIMITS.maxCount) {
    return NextResponse.json<UploadResponse>({ status: "too_many" }, { status: 422 });
  }

  let file: File | null = null;
  try {
    const value = (await request.formData()).get("file");
    file = value instanceof File ? value : null;
  } catch {
    file = null;
  }
  if (!file || file.size === 0)
    return NextResponse.json<UploadResponse>({ status: "invalid" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json<UploadResponse>({ status: "too_large" }, { status: 413 });
  }

  let processed;
  try {
    processed = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json<UploadResponse>({ status: "invalid" }, { status: 422 });
    }
    throw error;
  }

  // Write the file first; if the row is refused (limits, ownership), remove it again.
  const fileName = await writePhotoFile(scenarioId, processed.data);
  const result = addPhoto(db, user.id, scenarioId, {
    fileName,
    originalName: file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) || null,
    mimeType: processed.mimeType,
    bytes: processed.data.byteLength,
    width: processed.width,
    height: processed.height,
  });
  if (result.status !== "added") {
    await removePhotoFile(scenarioId, fileName);
    const code = result.status === "not_found" ? 404 : 422;
    return NextResponse.json<UploadResponse>({ status: result.status }, { status: code });
  }
  return NextResponse.json<UploadResponse>(
    { status: "added", photo: info(scenarioId, result.photo), usage: photoUsage(db, scenarioId) },
    { status: 201 },
  );
}
