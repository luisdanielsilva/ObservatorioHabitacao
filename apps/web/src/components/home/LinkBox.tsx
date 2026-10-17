"use client";

import { ArrowRight, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

/** The listing sites the reader supports, shown as chips under the box. */
const SITES = [
  { name: "Idealista.pt", dot: "bg-chart-1" },
  { name: "Imovirtual.com", dot: "bg-brand-accent" },
] as const;

/**
 * The home page's main action: paste a listing link and go straight to Avaliar anúncio, which
 * reads it. Manual entry is offered underneath.
 */
export function LinkBox() {
  const t = useTranslations("home");
  const id = useId();
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 rounded-2xl border-2 border-primary bg-background p-2 shadow-[0_0_0_6px_var(--mint),0_20px_40px_-26px_var(--pine-deep)] focus-within:shadow-[0_0_0_6px_var(--brand-accent),0_20px_40px_-26px_var(--pine-deep)] sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const link = url.trim();
          if (link) router.push({ pathname: "/avaliar", query: { link } });
        }}
      >
        <label htmlFor={`${id}-link`} className="sr-only">
          {t("linkLabel")}
        </label>
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            required
            placeholder={t("linkPlaceholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-describedby={`${id}-supported`}
            className="h-12 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-6 text-base">
          {t("evaluate")} <ArrowRight />
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-sm">
        <p id={`${id}-supported`} className="sr-only">
          {t("supported")}
        </p>
        {SITES.map((site) => (
          <span
            key={site.name}
            aria-hidden
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 font-medium"
          >
            <span className={`size-2 rounded-full ${site.dot}`} />
            {site.name}
          </span>
        ))}
        <Link
          href={{ pathname: "/avaliar", query: { manual: "1" } }}
          className="ml-1 font-semibold text-primary underline decoration-brand-accent decoration-2 underline-offset-4 hover:decoration-primary"
        >
          {t("manualLink")}
        </Link>
      </div>
    </div>
  );
}
