"use server";

import {
  cacheGet,
  cacheSet,
  getScenario,
  setScenarioSharePhotos,
  setScenarioSharing,
} from "@olhovivo/db";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { entitlementsFor } from "@/lib/entitlements";
import { renderScenarioPdf, reportFilename } from "@/lib/report/render";
import { getCurrentUser } from "@/lib/session";

export interface Sharing {
  /** The read-only link's token; null when the link is off. */
  token: string | null;
  /** Whether the link and its PDF show the property's photos. */
  photos: boolean;
}

/** The scenario's sharing settings, or undefined if it is not the user's. */
export async function getSharing(id: number): Promise<Sharing | undefined> {
  const user = await getCurrentUser();
  if (!user) return undefined;
  const scenario = getScenario(getDb(), id, user.id);
  return scenario ? { token: scenario.shareToken, photos: scenario.sharePhotos } : undefined;
}

/** Shows or hides the photos on the read-only link and its PDF; undefined if not the user's. */
export async function setSharePhotos(
  id: number,
  photos: boolean,
): Promise<{ photos: boolean } | undefined> {
  const user = await getCurrentUser();
  if (!user) return undefined;
  const result = setScenarioSharePhotos(getDb(), id, user.id, photos);
  return result === undefined ? undefined : { photos: result };
}

/**
 * Turns the public link on or off (WBS 6.3.4). Turning it off makes the old link 404 and hides
 * the photos again.
 */
export async function setSharing(
  id: number,
  shared: boolean,
): Promise<{ token: string | null } | undefined> {
  const user = await getCurrentUser();
  if (!user) return undefined;
  const token = setScenarioSharing(getDb(), id, user.id, shared);
  return token === undefined ? undefined : { token };
}

export type EmailReportResult = { status: "sent" | "invalid" | "limit" | "unavailable" | "error" };

/** Reports a user may email per day, to keep the feature from being used for spam. */
const DAILY_LIMIT = 10;

/** Emails the scenario's PDF report to any address the owner chooses. */
export async function emailReport(
  id: number,
  to: string,
  locale: AppLocale,
): Promise<EmailReportResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error" };
  if (!entitlementsFor(user.plan).pdfReports) return { status: "unavailable" };
  const address = z.email().max(200).safeParse(to.trim());
  if (!address.success) return { status: "invalid" };

  const db = getDb();
  const scenario = getScenario(db, id, user.id);
  if (!scenario) return { status: "error" };

  const key = `report-email:${user.id}:${new Date().toISOString().slice(0, 10)}`;
  const sent = cacheGet<number>(db, key) ?? 0;
  if (sent >= DAILY_LIMIT) return { status: "limit" };

  try {
    const pdf = await renderScenarioPdf(scenario, locale, { photos: true });
    if (!pdf) return { status: "error" };
    const t = await getTranslations({ locale, namespace: "share" });
    await sendEmail({
      to: address.data,
      subject: t("emailSubject", { name: scenario.name }),
      text: t("emailText", { name: scenario.name }),
      attachments: [{ filename: reportFilename(scenario.name), content: pdf }],
    });
    cacheSet(db, key, sent + 1, 24 * 3600);
    return { status: "sent" };
  } catch (error) {
    console.error("emailReport failed", error);
    return { status: "error" };
  }
}
