"use client";

import { FileDown, Link2Off, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { withBasePath } from "@/lib/basePath";
import { disableSharing, emailReport, getSharing, type EmailReportResult } from "./actions";

/**
 * A saved scenario's PDF, and emailing it to the account's address and one more (issue #12).
 * A read-only link made before can be turned off here; new ones are no longer made.
 */
export function ShareControls({
  scenarioId,
  email,
  size = "default",
}: {
  scenarioId: number;
  /** The account's address, where the report always goes. */
  email: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("reportShare");
  const locale = useLocale();
  const id = useId();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState<EmailReportResult | null>(null);
  const [pending, start] = useTransition();

  const message = !result
    ? null
    : result.status === "sent"
      ? t("sent", { to: result.to.join(` ${t("and")} `) })
      : result.status === "limit"
        ? result.window === "hour"
          ? t("limitHour")
          : t("limitDay")
        : t(result.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size={size} variant="outline">
        <a href={withBasePath(`/api/scenarios/${scenarioId}/pdf?lang=${locale}`)} download>
          <FileDown />
          <span className="sr-only sm:not-sr-only">PDF</span>
          <span className="sr-only">{t("download")}</span>
        </a>
      </Button>

      <Popover
        onOpenChange={(open) => {
          if (open && token === undefined) {
            start(async () => setToken((await getSharing(scenarioId))?.token ?? null));
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button size={size} variant="outline">
            <Mail />
            {t("send")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-4" align="end">
          <form
            noValidate
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await emailReport(
                  { kind: "saved", id: scenarioId },
                  extra,
                  locale === "en" ? "en" : "pt",
                );
                setResult(r);
                if (r.status === "sent") setExtra("");
              });
            }}
          >
            <p className="font-medium">{t("emailTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("emailTo", { email })}</p>
            <Label htmlFor={`${id}-extra`}>{t("extra")}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-extra`}
                type="email"
                maxLength={200}
                autoComplete="off"
                placeholder={t("extraPlaceholder")}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={pending}>
                {t("send")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {pending ? t("working") : message}
            </p>
          </form>

          {token && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs text-muted-foreground">{t("oldLink")}</p>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (await disableSharing(scenarioId)) setToken(null);
                  })
                }
              >
                <Link2Off />
                {t("disableLink")}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
