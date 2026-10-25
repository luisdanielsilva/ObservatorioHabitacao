"use client";

import { ArrowRight, Home, KeyRound, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LinkBox } from "./LinkBox";

/**
 * The situations a visitor can be in, each with its own colour of the palette. Buying covers a
 * listing seen, whose price is checked: both start from the listing link.
 */
const SITUATIONS = [
  { key: "buy", icon: Home, tile: "bg-mint text-primary" },
  { key: "sell", icon: Tag, tile: "bg-sand-soft text-brand-accent-foreground" },
  { key: "rent", icon: KeyRound, tile: "bg-moss-soft text-moss" },
] as const;
type Situation = (typeof SITUATIONS)[number]["key"];

/**
 * The home page's opening (issue #4): the visitor picks their situation and the question that
 * the site answers for it takes the headline, with the way in underneath (the listing link, or
 * Vender for a seller). Tabs in the ARIA pattern: arrows move between situations.
 */
export function QuestionHero({ showSell }: { showSell: boolean }) {
  const t = useTranslations("home");
  const id = useId();
  const situations = SITUATIONS.filter((s) => showSell || s.key !== "sell");
  const [current, setCurrent] = useState<Situation>("buy");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const target =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? situations.length - 1
          : step !== undefined
            ? (index + step + situations.length) % situations.length
            : null;
    if (target === null) return;
    e.preventDefault();
    tabs.current[target]?.focus();
    setCurrent(situations[target].key);
  }

  return (
    <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${current}`}
        className="min-w-0 lg:flex lg:min-h-[27rem] lg:flex-col lg:justify-center"
      >
        <p className="inline-flex items-center gap-2 self-start rounded-full bg-sand-soft px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-brand-accent-foreground uppercase">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          {t("situationsEyebrow")}
        </p>
        {/* key: the text fades in again when the situation changes. */}
        <div key={current} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t.rich(`situations.${current}.question`, {
              mark: (chunks) => <Underlined>{chunks}</Underlined>,
            })}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
            {t(`situations.${current}.answer`)}
          </p>
          <div className="mt-7">
            {current === "sell" ? (
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-brand-accent px-6 text-base font-semibold text-pine-deep shadow-md transition hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--brand-accent),white_18%)] hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Link href="/vender">
                  {t("situations.sell.cta")} <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <LinkBox />
            )}
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("situationsLabel")}
        aria-orientation="vertical"
        className={cn(
          "order-first grid gap-2 lg:order-none lg:grid-cols-1 lg:gap-2.5",
          situations.length === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {situations.map(({ key, icon: Icon, tile }, i) => {
          const selected = key === current;
          return (
            <button
              key={key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-${key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCurrent(key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "grid w-full justify-items-center gap-1.5 rounded-2xl border bg-background/85 p-3 text-center transition lg:grid-cols-[auto_1fr_auto] lg:items-center lg:justify-items-stretch lg:gap-3.5 lg:p-4 lg:text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                selected
                  ? "border-2 border-primary p-[11px] shadow-[0_0_0_5px_var(--mint)] lg:p-[15px]"
                  : "hover:border-primary/50",
              )}
            >
              <span className={`grid size-9 place-items-center rounded-xl lg:size-11 ${tile}`}>
                <Icon className="size-5.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-semibold lg:text-base">
                  {t(`situations.${key}.label`)}
                </span>
                <span className="hidden text-sm text-muted-foreground lg:block">
                  {t(`situations.${key}.hint`)}
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "hidden size-5 lg:block",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The part of a headline that matters, in pine with a hand-drawn sand underline. The curve is a
 * background (globals.css, .curve-underline) so it follows each line when the words wrap.
 */
export function Underlined({ children }: { children: ReactNode }) {
  return <span className="curve-underline text-primary">{children}</span>;
}
