"use server";

import { getScenario, rateLimit, setScenarioSharing } from "@observatorio-habitacao/db";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { entitlementsFor } from "@/lib/entitlements";
import { FEATURES } from "@/lib/features";
import { reportRecipients } from "@/lib/report/recipients";
import { renderScenarioPdf, reportFilename, sourceFromState } from "@/lib/report/render";
import { renderValuationPdf } from "@/lib/report/valuation";
import { getMember } from "@/lib/session";
import { localizedUrl } from "@/lib/urls";

/** The scenario's read-only link token (null when off), or undefined if it is not the user's. */
export async function getSharing(id: number): Promise<{ token: string | null } | undefined> {
  const user = await getMember();
  if (!user) return undefined;
  const scenario = getScenario(getDb(), id, user.id);
  return scenario ? { token: scenario.shareToken } : undefined;
}

/**
 * Turns a read-only link off. New links are no longer made (issue #12); links shared before
 * keep working until their owner turns them off here.
 */
export async function disableSharing(id: number): Promise<boolean> {
  const user = await getMember();
  if (!user) return false;
  return setScenarioSharing(getDb(), id, user.id, false) !== undefined;
}

/** What to make the emailed report from: the evaluation or valuation on screen, or a saved one. */
export type ReportInput =
  | { kind: "scenario"; name: string; state: unknown; savedId?: number | null }
  | { kind: "valuation"; name: string; state: unknown }
  | { kind: "saved"; id: number };

export type EmailReportResult =
  | { status: "sent"; to: string[] }
  | { status: "limit"; window: "hour" | "day" }
  | { status: "signin" | "invalid" | "error" };

const MAX_INPUT_BYTES = 100_000;

/**
 * Emails the PDF report (issue #12) to the account's address and, optionally, one more. Only
 * for signed-in users, within their plan's limit (5 an hour on the free plan). The email has
 * the PDF and a few words about the site; no link to the simulation.
 */
export async function emailReport(
  input: ReportInput,
  extra: string,
  locale: AppLocale,
): Promise<EmailReportResult> {
  const user = await getMember();
  if (!user) return { status: "signin" };
  if (!user.email) return { status: "error" };
  const to = reportRecipients(user.email, extra);
  if (!to || JSON.stringify(input).length > MAX_INPUT_BYTES) return { status: "invalid" };

  const db = getDb();
  const { limit, windowSeconds } = entitlementsFor(user.plan).reportEmails;
  if (!rateLimit(db, `report-email:${user.id}`, limit, windowSeconds).allowed) {
    return { status: "limit", window: windowSeconds <= 3600 ? "hour" : "day" };
  }

  try {
    let report: { name: string; pdf: Buffer | undefined };
    if (input.kind === "valuation") {
      if (!FEATURES.sell) return { status: "error" };
      const name = input.name.trim().slice(0, 120);
      const valuation = { name, input: (input.state ?? {}) as Record<string, unknown> };
      report = { name, pdf: await renderValuationPdf(valuation, locale, user) };
    } else {
      const saved =
        input.kind === "saved"
          ? getScenario(db, input.id, user.id)
          : input.savedId
            ? getScenario(db, input.savedId, user.id)
            : undefined;
      const source =
        input.kind === "saved"
          ? saved
          : sourceFromState(input, saved ? { id: saved.id, userId: user.id } : null);
      if (!source) return { status: "error" };
      const pdf = await renderScenarioPdf(source, locale, { photos: true, author: user });
      report = { name: source.name, pdf };
    }
    if (!report.pdf) return { status: "error" };

    const t = await getTranslations({ locale, namespace: "reportEmail" });
    const site = localizedUrl(locale, "/");
    const name = report.name || t("untitled");
    const attachments = [{ filename: reportFilename(name), content: report.pdf }];
    const body = (intro: string) =>
      [intro, t("about", { site }), t("disclaimer"), `Observatório Habitação\n${site}`].join(
        "\n\n",
      );
    await sendEmail({
      to: user.email,
      subject: t("subject", { name }),
      text: body(t("toSelf", { name })),
      attachments,
    });
    if (to[1]) {
      const sender = user.name?.trim() ? `${user.name.trim()} (${user.email})` : user.email;
      await sendEmail({
        to: to[1],
        subject: t("subject", { name }),
        text: body(t("toOther", { name, sender })),
        replyTo: user.email,
        attachments,
      });
    }
    return { status: "sent", to };
  } catch (error) {
    console.error("emailReport failed", error);
    return { status: "error" };
  }
}
