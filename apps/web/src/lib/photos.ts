import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_SIDE, MAX_UPLOAD_BYTES } from "@/lib/photoPrepare";

export { MAX_UPLOAD_BYTES };

/**
 * Property photos of saved scenarios, as files on the server's disk:
 * `<PHOTOS_DIR>/<scenario id>/<random>.webp`, next to the database by default.
 * Rows in `scenario_photos` (packages/db/src/photos.ts) say which files belong to whom.
 */
export function photosDir(): string {
  if (process.env.PHOTOS_DIR) return process.env.PHOTOS_DIR;
  const database =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "../../data/observatorio-habitacao.db");
  return path.join(path.dirname(database), "photos");
}

const scenarioDir = (scenarioId: number) => path.join(photosDir(), String(scenarioId));

const MAX_INPUT_PIXELS = 50_000_000;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export class InvalidImageError extends Error {}

/**
 * Decodes, checks and re-encodes an uploaded image: rotated by its EXIF orientation, at most
 * 1600 px on its longest side, as WebP. Re-encoding drops every metadata block (camera, GPS
 * location), and anything that is not a real JPEG, PNG, WebP or AVIF image is rejected.
 */
export async function processPhoto(input: Buffer) {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new InvalidImageError();
    const { data, info } = await image
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, mimeType: "image/webp" as const };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError(String(error));
  }
}

/** Writes a processed photo under a new random name and returns that name. */
export async function writePhotoFile(scenarioId: number, data: Buffer): Promise<string> {
  const fileName = `${randomUUID()}.webp`;
  await mkdir(scenarioDir(scenarioId), { recursive: true });
  await writeFile(path.join(scenarioDir(scenarioId), fileName), data, { flag: "wx" });
  return fileName;
}

export function photoFilePath(scenarioId: number, fileName: string): string {
  // Names come from the database and are always "<uuid>.webp"; basename() guards anyway.
  return path.join(scenarioDir(scenarioId), path.basename(fileName));
}

export async function removePhotoFile(scenarioId: number, fileName: string): Promise<void> {
  await unlink(photoFilePath(scenarioId, fileName)).catch(() => {});
}

/** Removes every photo file of a scenario (after the scenario or the account is deleted). */
export async function removeScenarioPhotos(scenarioId: number): Promise<void> {
  await rm(scenarioDir(scenarioId), { recursive: true, force: true });
}
