"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const next = locale === "pt" ? "en" : "pt";

  return (
    <Button
      variant="ghost"
      size="sm"
      lang={next === "pt" ? "pt-PT" : "en"}
      aria-label={`${t("language")}: ${t("switchTo")}`}
      onClick={() =>
        // Keep the query string (e.g. calculator inputs) when switching language.
        router.replace(
          { pathname, query: Object.fromEntries(new URLSearchParams(window.location.search)) },
          { locale: next, scroll: false },
        )
      }
    >
      {next.toUpperCase()}
    </Button>
  );
}
