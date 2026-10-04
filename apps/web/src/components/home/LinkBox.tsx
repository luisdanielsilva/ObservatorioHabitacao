"use client";

import { ArrowRight, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

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
        className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-primary/5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 sm:flex-row"
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
      <div className="flex flex-col gap-1 px-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p id={`${id}-supported`} className="text-muted-foreground">
          {t("supported")}
        </p>
        <Link
          href={{ pathname: "/avaliar", query: { manual: "1" } }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("manualLink")}
        </Link>
      </div>
    </div>
  );
}
