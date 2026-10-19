"use client";

import { FileDown, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { emailReport, type EmailReportResult, type ReportInput } from "./actions";

/** The signed-in user, as the report box needs them. */
export interface ReportMember {
  email: string;
}

type Message = EmailReportResult | { status: "pdfLimit" | "pdfError" };

/**
 * The report and how to share it (issues #5 and #12): download the PDF, or email it to the
 * account's address and one more. Without signing in the PDF has a watermark and emailing it
 * asks to sign in. The report is made from what is on screen, without saving it.
 */
export function ReportShare({
  input,
  member,
  returnTo,
}: {
  /** What is on screen, made into the report when asked. */
  input: () => Extract<ReportInput, { kind: "scenario" | "valuation" }>;
  member: ReportMember | null;
  /** The page to come back to after signing in, where the work in progress is restored. */
  returnTo: "/avaliar" | "/vender";
}) {
  const t = useTranslations("reportShare");
  const locale = useLocale();
  const id = useId();
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, start] = useTransition();
  const lang = locale === "en" ? "en" : "pt";
  const signIn = {
    pathname: "/entrar" as const,
    query: { voltar: `${locale === "pt" ? "" : `/${locale}`}${returnTo}` },
  };

  const download = () =>
    start(async () => {
      setMessage(null);
      const report = input();
      const endpoint = report.kind === "valuation" ? "/api/report/valuation" : "/api/report";
      const res = await fetch(withBasePath(`${endpoint}?lang=${lang}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: report.name,
          state: report.state,
          ...(report.kind === "scenario" && { savedId: report.savedId ?? null }),
        }),
      }).catch(() => null);
      if (!res?.ok) return setMessage({ status: res?.status === 429 ? "pdfLimit" : "pdfError" });
      const file = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = file ?? "observatorio-habitacao.pdf";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });

  const send = () =>
    start(async () => {
      setMessage(null);
      const result = await emailReport(input(), extra, lang);
      setMessage(result);
      if (result.status === "sent") setExtra("");
    });

  const text = (() => {
    if (!message) return null;
    switch (message.status) {
      case "sent":
        return t("sent", { to: message.to.join(` ${t("and")} `) });
      case "limit":
        return message.window === "hour" ? t("limitHour") : t("limitDay");
      default:
        return t(message.status);
    }
  })();

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 id={`${id}-title`} className="font-semibold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="space-y-2">
        <Button variant="outline" disabled={pending} onClick={download}>
          <FileDown />
          {t("download")}
        </Button>
        {!member && (
          <p className="text-sm text-muted-foreground">
            {t("watermark")}{" "}
            <Link href={signIn} className="font-medium text-primary underline">
              {t("signIn")} →
            </Link>
          </p>
        )}
      </div>

      {member && (
        <form
          noValidate
          className="space-y-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Mail className="size-4" aria-hidden />
            {t("emailTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("emailTo", { email: member.email })}</p>
          <Label htmlFor={`${id}-extra`}>{t("extra")}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-extra`}
              type="email"
              maxLength={200}
              autoComplete="off"
              placeholder={t("extraPlaceholder")}
              className="min-w-48 flex-1"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              <Mail />
              {t("send")}
            </Button>
          </div>
        </form>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? (
          t("working")
        ) : message?.status === "limit" && message.window === "hour" ? (
          <>
            {text}{" "}
            <Link href="/contactos" className="font-medium text-primary underline">
              {t("paidPlanContact")} →
            </Link>
          </>
        ) : message?.status === "signin" ? (
          <>
            {text}{" "}
            <Link href={signIn} className="font-medium text-primary underline">
              {t("signIn")} →
            </Link>
          </>
        ) : (
          text
        )}
      </p>
    </section>
  );
}
