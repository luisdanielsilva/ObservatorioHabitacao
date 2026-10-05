"use client";

import { Eye, FileText, Mail, MessageCircle, MessagesSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Sharing the results: email, WhatsApp, Facebook Messenger and a PDF (view it, or send it to
 * the account's email). A mock-up for now: the buttons are shown but do nothing.
 */
export function ShareMock() {
  const t = useTranslations("shareMock");
  const id = useId();

  const channels = [
    { key: "email", icon: Mail },
    { key: "whatsapp", icon: MessageCircle },
    { key: "messenger", icon: MessagesSquare },
  ] as const;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="font-semibold">
          {t("title")}
        </h3>
        <Badge variant="secondary">{t("soon")}</Badge>
      </div>
      <p id={`${id}-note`} className="text-sm text-muted-foreground">
        {t("intro")}
      </p>

      <div className="flex flex-wrap gap-2">
        {channels.map(({ key, icon: Icon }) => (
          <Button key={key} variant="outline" disabled aria-describedby={`${id}-note`}>
            <Icon />
            {t(key)}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4" aria-hidden />
          {t("pdf")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled aria-describedby={`${id}-note`}>
            <Eye />
            {t("viewPdf")}
          </Button>
          <Button variant="outline" disabled aria-describedby={`${id}-note`}>
            <Send />
            {t("sendPdf")}
          </Button>
        </div>
      </div>
    </section>
  );
}
