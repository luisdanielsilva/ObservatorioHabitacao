"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A small "?" button that shows a help text. A popover (not a tooltip) so it works on touch. */
export function HelpTip({ label, text }: { label: string; text: string }) {
  const t = useTranslations("common");
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={t("help", { label })}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm" side="top">
        {text}
      </PopoverContent>
    </Popover>
  );
}
