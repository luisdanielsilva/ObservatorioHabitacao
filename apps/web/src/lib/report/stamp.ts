import "server-only";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { localizedUrl } from "@/lib/urls";
import type { ReportStamp } from "./Report";

/** The signed-in person a report is made for. */
export interface ReportAuthor {
  name?: string | null;
  email: string;
}

/**
 * When and by whom a report was made, and the site's address, for every page's header and
 * footer (issue #13). No author when the report is made without signing in; then the report
 * has the watermark (issue #12), unless `watermark` is false (the home page's example).
 */
export async function reportStamp(
  locale: AppLocale,
  author: ReportAuthor | null,
  { now = new Date(), watermark = author === null }: { now?: Date; watermark?: boolean } = {},
): Promise<ReportStamp> {
  const t = await getTranslations({ locale, namespace: "share.report" });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(now);
  const name = author?.name?.trim();
  const href = localizedUrl(locale, "/");
  return {
    generated: t("generated", { date }),
    by: author
      ? t("generatedBy", { who: name ? `${name} · ${author.email}` : author.email })
      : null,
    site: { href, label: href.replace(/^https?:\/\//, "") },
    watermark: watermark ? t("watermark") : null,
  };
}
