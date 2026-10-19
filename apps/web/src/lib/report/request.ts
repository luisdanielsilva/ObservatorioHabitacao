import "server-only";
import { clientIp, rateLimit } from "@observatorio-habitacao/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

/** An evaluation sent to be made into a report: its name and inputs, as on screen. */
const ReportBody = z.object({
  name: z.string().max(200),
  state: z.unknown(),
  /** The user's saved scenario it was opened from, for that scenario's photos. */
  savedId: z.number().int().positive().nullish(),
});
export type ReportBody = z.infer<typeof ReportBody>;

const MAX_BODY_BYTES = 100_000;

/** Reports made per hour: by IP without signing in, by account when signed in. */
const PDFS_PER_HOUR = { anonymous: 10, member: 60 };

/**
 * Reads a report request (issue #12), within the hourly limit: rendering a PDF is heavy for the
 * server, and anyone can ask for one. Returns the body, or the response to send instead.
 */
export async function readReportRequest(
  request: Request,
  user: CurrentUser | null,
): Promise<{ body: ReportBody } | { response: NextResponse }> {
  const limit = rateLimit(
    getDb(),
    `report-pdf:${user ? user.id : clientIp(request.headers)}`,
    user ? PDFS_PER_HOUR.member : PDFS_PER_HOUR.anonymous,
    3600,
  );
  if (!limit.allowed) {
    return {
      response: NextResponse.json(
        { error: "limit" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      ),
    };
  }
  const text = await request.text();
  const parsed = text.length <= MAX_BODY_BYTES ? ReportBody.safeParse(safeJson(text)) : null;
  if (!parsed?.success) {
    return { response: NextResponse.json({ error: "invalid" }, { status: 400 }) };
  }
  return { body: parsed.data };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
