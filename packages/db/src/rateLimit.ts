import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { cache } from "./schema";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

/**
 * Fixed-window rate limit stored in the SQLite cache table (no Redis). Counts requests for
 * `key` in windows of `windowSeconds`; the increment is a single atomic upsert, so it is safe
 * across processes sharing the database.
 */
export function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  now = Math.floor(Date.now() / 1000),
): RateLimitResult {
  const windowStart = now - (now % windowSeconds);
  const expiresAt = windowStart + windowSeconds;
  const cacheKey = `ratelimit:${key}:${windowStart}`;

  db.insert(cache)
    .values({ key: cacheKey, value: 1, expiresAt })
    .onConflictDoUpdate({
      target: cache.key,
      set: { value: sql`json(${cache.value}) + 1` },
    })
    .run();
  const row = db.select({ value: cache.value }).from(cache).where(eq(cache.key, cacheKey)).get();
  const used = Number(row?.value ?? 1);
  return {
    allowed: used <= limit,
    remaining: Math.max(0, limit - used),
    retryAfter: expiresAt - now,
  };
}

/** The client IP behind the reverse proxy (Nginx sets X-Real-IP and X-Forwarded-For). */
export function clientIp(headers: { get(name: string): string | null }): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
