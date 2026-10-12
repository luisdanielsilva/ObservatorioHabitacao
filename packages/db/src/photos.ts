import { and, asc, count, eq, isNotNull, sum } from "drizzle-orm";
import type { Db } from "./client";
import { scenarioPhotos, scenarios } from "./schema";

/** Per saved scenario: whichever limit is reached first. */
export const PHOTO_LIMITS = { maxCount: 30, maxBytes: 5 * 1024 * 1024 } as const;

export type PhotoRow = typeof scenarioPhotos.$inferSelect;

export interface PhotoUsage {
  count: number;
  bytes: number;
}

const ownsScenario = (db: Db, scenarioId: number, userId: string) =>
  !!db
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.userId, userId)))
    .get();

export function photoUsage(db: Db, scenarioId: number): PhotoUsage {
  const row = db
    .select({ count: count(), bytes: sum(scenarioPhotos.bytes) })
    .from(scenarioPhotos)
    .where(eq(scenarioPhotos.scenarioId, scenarioId))
    .get();
  return { count: row?.count ?? 0, bytes: Number(row?.bytes ?? 0) };
}

/** The photos of a scenario, oldest first, for its owner; undefined if it is not theirs. */
export function listPhotos(db: Db, scenarioId: number, userId: string): PhotoRow[] | undefined {
  if (!ownsScenario(db, scenarioId, userId)) return undefined;
  return db
    .select()
    .from(scenarioPhotos)
    .where(eq(scenarioPhotos.scenarioId, scenarioId))
    .orderBy(asc(scenarioPhotos.id))
    .all();
}

export type AddPhotoResult =
  { status: "added"; photo: PhotoRow } | { status: "not_found" | "too_many" | "too_large" };

/**
 * Records an uploaded photo, checking ownership and both limits in one transaction so that
 * concurrent uploads cannot go over them. The caller writes the file first and removes it when
 * this does not return "added", so no row ever points to a missing file.
 */
export function addPhoto(
  db: Db,
  userId: string,
  scenarioId: number,
  photo: Omit<typeof scenarioPhotos.$inferInsert, "id" | "scenarioId" | "createdAt">,
): AddPhotoResult {
  return db.transaction((tx) => {
    if (!ownsScenario(tx as unknown as Db, scenarioId, userId)) return { status: "not_found" };
    const usage = photoUsage(tx as unknown as Db, scenarioId);
    if (usage.count >= PHOTO_LIMITS.maxCount) return { status: "too_many" };
    if (usage.bytes + photo.bytes > PHOTO_LIMITS.maxBytes) return { status: "too_large" };
    const row = tx
      .insert(scenarioPhotos)
      .values({ ...photo, scenarioId })
      .returning()
      .get();
    return { status: "added", photo: row };
  });
}

/** One photo, for the owner of its scenario. */
export function getPhoto(
  db: Db,
  scenarioId: number,
  photoId: number,
  userId: string,
): PhotoRow | undefined {
  if (!ownsScenario(db, scenarioId, userId)) return undefined;
  return db
    .select()
    .from(scenarioPhotos)
    .where(and(eq(scenarioPhotos.id, photoId), eq(scenarioPhotos.scenarioId, scenarioId)))
    .get();
}

/** Deletes a photo's row; returns it so the caller can remove the file. */
export function deletePhoto(
  db: Db,
  scenarioId: number,
  photoId: number,
  userId: string,
): PhotoRow | undefined {
  const photo = getPhoto(db, scenarioId, photoId, userId);
  if (!photo) return undefined;
  db.delete(scenarioPhotos).where(eq(scenarioPhotos.id, photo.id)).run();
  return photo;
}

/** Ids of a user's scenarios, so their photo folders can be removed with the account. */
export function scenarioIdsOfUser(db: Db, userId: string): number[] {
  return db
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(eq(scenarios.userId, userId))
    .all()
    .map((r) => r.id);
}

/** The scenario a share token opens, when its owner chose to show the photos. */
const sharedWithPhotos = (db: Db, token: string) =>
  /^[\w-]{16}$/.test(token)
    ? db
        .select({ id: scenarios.id })
        .from(scenarios)
        .where(
          and(
            eq(scenarios.shareToken, token),
            isNotNull(scenarios.shareToken),
            eq(scenarios.sharePhotos, true),
          ),
        )
        .get()
    : undefined;

/**
 * The photos of a shared scenario, oldest first, for anyone with the link; empty when the link
 * is off or its owner has not chosen to show them.
 */
export function listSharedPhotos(db: Db, token: string): PhotoRow[] {
  const scenario = sharedWithPhotos(db, token);
  if (!scenario) return [];
  return db
    .select()
    .from(scenarioPhotos)
    .where(eq(scenarioPhotos.scenarioId, scenario.id))
    .orderBy(asc(scenarioPhotos.id))
    .all();
}

/** One photo of a shared scenario, under the same conditions as listSharedPhotos. */
export function getSharedPhoto(db: Db, token: string, photoId: number): PhotoRow | undefined {
  const scenario = sharedWithPhotos(db, token);
  if (!scenario) return undefined;
  return db
    .select()
    .from(scenarioPhotos)
    .where(and(eq(scenarioPhotos.id, photoId), eq(scenarioPhotos.scenarioId, scenario.id)))
    .get();
}
