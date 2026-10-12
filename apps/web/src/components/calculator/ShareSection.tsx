"use client";

import {
  AtSign,
  Check,
  Copy,
  Eye,
  FileText,
  Link2Off,
  Mail,
  MessageCircle,
  MessagesSquare,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  emailScenarioLink,
  shareScenario,
  type SaveResult,
  type ShareResult,
} from "@/app/[locale]/avaliar/actions";
import { setSharing } from "@/components/share/actions";
import { SharePhotosOption } from "@/components/share/SharePhotosOption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { CalculatorState } from "@/lib/calculator/state";
import type { SavedScenario } from "./saved";
import { signInToSaveHref } from "./SaveBar";

type Channel = "email" | "whatsapp" | "messenger";
type Action = Channel | "account" | "pdf";

type Message =
  | { kind: "signin" | "limit" | "emailLimit" | "error" | "messengerCopied" | "disabled" }
  | { kind: "sent"; email: string };

/**
 * Sharing the results (WBS 6.3.4): every channel sends a read-only link to this evaluation on
 * OlhoVivo; "Ver PDF" opens the full report in a new tab instead. The evaluation is saved first, as on
 * screen, so what is shared is always what the user sees (signing in if needed).
 */
export function ShareSection({
  state,
  name,
  saved,
  currentKey,
  onSaved,
  ensureSaved,
}: {
  state: CalculatorState;
  name: string;
  saved: SavedScenario | null;
  /** The current name and inputs, recorded as saved after a save. */
  currentKey: string;
  onSaved: (saved: SavedScenario) => void;
  /** Saves the evaluation as on screen, unless it already is. */
  ensureSaved: () => Promise<SaveResult>;
}) {
  const t = useTranslations("shareResults");
  const locale = useLocale();
  const id = useId();
  const [message, setMessage] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const inSync = saved !== null && saved.key === currentKey;
  const prefix = locale === "pt" ? "" : `/${locale}`;
  const linkFor = (token: string) => `${window.location.origin}${prefix}/partilha/${token}`;
  const pdfUrl = (scenarioId: number) => `/api/scenarios/${scenarioId}/pdf?lang=${locale}`;
  // Ready to send straight away: saved as shown, with the link on.
  const readyLink = inSync && saved.token ? linkFor(saved.token) : null;
  const mobile =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const href = (channel: Channel, url: string): string | null => {
    const text = t("messageText", { name });
    switch (channel) {
      case "email":
        return `mailto:?subject=${encodeURIComponent(t("emailSubject", { name }))}&body=${encodeURIComponent(t("emailText", { name, url }))}`;
      case "whatsapp":
        return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
      case "messenger":
        // The Messenger app's share link; on a computer, the link is copied to paste in a chat.
        return mobile ? `fb-messenger://share/?link=${encodeURIComponent(url)}` : null;
    }
  };

  /** Opens the channel with the link. Web pages open in a new tab (`tab`, if already open). */
  const send = async (channel: Channel, url: string, tab?: Window | null) => {
    const target = href(channel, url);
    if (target?.startsWith("https:")) {
      if (tab) {
        tab.opener = null;
        tab.location.href = target;
      } else window.open(target, "_blank", "noopener,noreferrer");
    } else if (target) {
      window.location.assign(target);
    } else {
      await navigator.clipboard?.writeText(url).catch(() => {});
      setMessage({ kind: "messengerCopied" });
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
    }
  };

  const failure = (status: Exclude<ShareResult["status"], "shared">): Message => ({
    kind: status === "signin" ? "signin" : status === "limit" ? "limit" : "error",
  });

  /** Saves (and shares) first, then does what the user asked. */
  const run = (action: Action) => {
    setMessage(null);
    // Opened now, while the click still allows it; pointed at the link or PDF once it exists.
    const tab = action === "whatsapp" || action === "pdf" ? window.open("", "_blank") : null;
    start(async () => {
      const key = currentKey;
      const input = { id: saved?.id ?? null, name, state };
      if (action === "pdf") {
        const r = await ensureSaved();
        if (r.status !== "saved") {
          tab?.close();
          return setMessage(failure(r.status));
        }
        if (tab) {
          tab.opener = null;
          tab.location.href = pdfUrl(r.id);
        } else window.open(pdfUrl(r.id), "_blank", "noopener");
        return;
      }
      if (action === "account") {
        const r = await emailScenarioLink(input, locale === "en" ? "en" : "pt");
        if (r.status !== "sent") {
          return setMessage(r.status === "emailLimit" ? { kind: "emailLimit" } : failure(r.status));
        }
        onSaved({ id: r.id, key, token: r.token });
        return setMessage({ kind: "sent", email: r.email });
      }
      const r = await shareScenario(input);
      if (r.status !== "shared") {
        tab?.close();
        return setMessage(failure(r.status));
      }
      onSaved({ id: r.id, key, token: r.token });
      await send(action, linkFor(r.token), tab);
    });
  };

  const disable = () =>
    start(async () => {
      if (!saved) return;
      const r = await setSharing(saved.id, false);
      if (r) {
        onSaved({ ...saved, token: null });
        setCopied(false);
        setMessage({ kind: "disabled" });
      }
    });

  const channels = [
    { key: "email", icon: Mail },
    { key: "whatsapp", icon: MessageCircle },
    { key: "messenger", icon: MessagesSquare },
  ] as const;

  const messageText =
    message?.kind === "sent"
      ? t("sent", { email: message.email })
      : message && message.kind !== "signin"
        ? t(message.kind)
        : null;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <h3 id={`${id}-title`} className="font-semibold">
        {t("title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="flex flex-wrap gap-2">
        {channels.map(({ key, icon: Icon }) => {
          const target = readyLink ? href(key, readyLink) : null;
          return target ? (
            <Button key={key} asChild variant="outline">
              <a
                href={target}
                {...(target.startsWith("https:") && {
                  target: "_blank",
                  rel: "noopener noreferrer",
                })}
              >
                <Icon />
                {t(key)}
              </a>
            </Button>
          ) : (
            <Button
              key={key}
              variant="outline"
              disabled={pending}
              onClick={() => (readyLink ? void send(key, readyLink) : run(key))}
            >
              <Icon />
              {t(key)}
            </Button>
          );
        })}
        <Button variant="outline" disabled={pending} onClick={() => run("account")}>
          <AtSign />
          {t("account")}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4" aria-hidden />
          {t("pdf")}
        </p>
        {inSync ? (
          <Button asChild variant="outline">
            <a href={pdfUrl(saved.id)} target="_blank" rel="noopener">
              <Eye />
              {t("viewPdf")}
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled={pending} onClick={() => run("pdf")}>
            <Eye />
            {t("viewPdf")}
          </Button>
        )}
      </div>

      {saved?.token && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor={`${id}-link`}>{t("link")}</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-link`}
              readOnly
              value={linkFor(saved.token)}
              onFocus={(e) => e.target.select()}
            />
            <Button
              size="icon"
              variant="secondary"
              aria-label={t("copy")}
              onClick={async () => {
                await navigator.clipboard.writeText(linkFor(saved.token!));
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <p className="sr-only" aria-live="polite">
            {copied ? t("copied") : ""}
          </p>
          {!inSync && <p className="text-xs text-muted-foreground">{t("linkOutdated")}</p>}
          <SharePhotosOption key={saved.token} scenarioId={saved.id} />
          <Button variant="ghost" size="sm" disabled={pending} onClick={disable}>
            <Link2Off />
            {t("disable")}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? (
          t("working")
        ) : message?.kind === "signin" ? (
          <>
            {t("signin")}{" "}
            <Link href={signInToSaveHref(locale)} className="font-medium text-primary underline">
              {t("signinLink")} →
            </Link>
          </>
        ) : (
          messageText
        )}
      </p>
    </section>
  );
}
