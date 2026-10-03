"use client";

import { Check, Copy, FileDown, Mail, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { emailReport, getSharing, setSharing, type EmailReportResult } from "./actions";

/** PDF download, public link (with X / Facebook / copy) and email for a saved scenario. */
export function ShareControls({
  scenarioId,
  name,
  size = "default",
}: {
  scenarioId: number;
  name: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("share");
  const locale = useLocale();
  const id = useId();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailResult, setEmailResult] = useState<EmailReportResult | null>(null);
  const [pending, start] = useTransition();

  const prefix = locale === "pt" ? "" : `/${locale}`;
  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}${prefix}/partilha/${token}`
      : null;
  const postText = t("postText", { name });

  const emailMessage = emailResult
    ? {
        sent: t("sent"),
        invalid: t("emailInvalid"),
        limit: t("emailLimit"),
        unavailable: t("notAvailable"),
        error: t("emailError"),
      }[emailResult.status]
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size={size} variant="outline">
        <a href={`/api/scenarios/${scenarioId}/pdf?lang=${locale}`} download>
          <FileDown />
          <span className="sr-only sm:not-sr-only">{t("pdf")}</span>
          <span className="sr-only">{t("downloadPdf")}</span>
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
            <Share2 />
            {t("share")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-4" align="end">
          <div className="space-y-1">
            <p className="font-medium">{t("shareTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("shareHelp")}</p>
          </div>

          {token === undefined ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : shareUrl ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-link`}>{t("link")}</Label>
              <div className="flex gap-2">
                <Input
                  id={`${id}-link`}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label={t("copy")}
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <p className="sr-only" aria-live="polite">
                {copied ? t("copied") : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`https://x.com/intent/post?${new URLSearchParams({ text: postText, url: shareUrl })}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("shareX")}
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: shareUrl })}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("shareFacebook")}
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setToken((await setSharing(scenarioId, false))?.token ?? null);
                      setCopied(false);
                    })
                  }
                >
                  {t("disable")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => setToken((await setSharing(scenarioId, true))?.token ?? null))
              }
            >
              {t("enable")}
            </Button>
          )}

          <form
            className="space-y-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const result = await emailReport(scenarioId, email, locale === "en" ? "en" : "pt");
                setEmailResult(result);
                if (result.status === "sent") setEmail("");
              });
            }}
          >
            <Label htmlFor={`${id}-email`}>{t("emailTitle")}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-email`}
                type="email"
                required
                maxLength={200}
                placeholder={t("emailTo")}
                aria-label={t("emailTo")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={pending}>
                <Mail />
                {pending ? t("sending") : t("send")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {emailMessage}
            </p>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
