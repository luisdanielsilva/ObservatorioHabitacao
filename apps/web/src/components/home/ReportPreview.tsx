"use client";

/* eslint-disable @next/next/no-img-element -- WebP pages already sized by scripts/report-preview.mjs */

import { Download, Eye, Maximize2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/basePath";
import { cn } from "@/lib/utils";
import { Underlined } from "./QuestionHero";
import { REPORT_PREVIEW } from "./reportPreview";

/** What the report has, page by page, and the page each entry opens at. */
const CHAPTERS = [
  { key: "market", page: 1, pages: "1" },
  { key: "results", page: 2, pages: "2" },
  { key: "summary", page: 3, pages: "3" },
  { key: "deals", page: 4, pages: "4–7" },
] as const;

/** The report's pages, as named in the messages (home.report.pages). */
const PAGE_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const pageKey = (n: number) => PAGE_KEYS[n - 1]!;

/** The three sheets of the fan: back left, back right, front. */
const SHEETS = [
  {
    page: 2,
    className:
      "z-[1] -translate-x-[88%] translate-y-[4%] -rotate-[8deg] group-hover:-translate-x-full group-hover:translate-y-[3%] group-hover:-rotate-[11deg] group-focus-visible:-translate-x-full group-focus-visible:-rotate-[11deg]",
  },
  {
    page: 4,
    className:
      "z-[2] -translate-x-[12%] translate-y-[3%] rotate-[7deg] group-hover:translate-x-0 group-hover:translate-y-[2%] group-hover:rotate-[10deg] group-focus-visible:translate-x-0 group-focus-visible:rotate-[10deg]",
  },
  {
    page: 1,
    className:
      "z-[3] -translate-x-1/2 -rotate-[1.5deg] group-hover:-translate-y-[1.5%] group-hover:-rotate-1 group-focus-visible:-rotate-1",
  },
] as const;

/**
 * The PDF report on the home page (issue #9): the example's pages fanned like sheets, what each
 * page has, and a viewer with every page full size, plus the PDF itself. The pages are made by
 * scripts/report-preview.mjs from the development example (the T1 in Braga).
 */
export function ReportPreview() {
  const t = useTranslations("home.report");
  const locale = useLocale() as keyof typeof REPORT_PREVIEW;
  const { pages, pdfKb } = REPORT_PREVIEW[locale];
  const base = withBasePath(`/relatorio-exemplo/${locale}`);
  const src = (page: number, size: "small" | "large") => `${base}/pagina-${page}-${size}.webp`;
  const pdf = `${base}/relatorio-exemplo.pdf`;

  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState(1);

  function goTo(page: number, instant = false) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!el || !scroller.current) return;
    scroller.current.scrollTo({
      top: el.offsetTop - 16,
      behavior: instant ? "instant" : "smooth",
    });
    setCurrent(page);
  }

  function open(page: number, from: HTMLElement) {
    opener.current = from;
    dialog.current?.showModal();
    requestAnimationFrame(() => goTo(page, true));
  }

  // The page counter follows the scroll.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const seen = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) setCurrent(Number((top.target as HTMLElement).dataset.page));
      },
      { root, threshold: [0.35, 0.6] },
    );
    root.querySelectorAll("[data-page]").forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, []);

  // Only the pages that have a name: a longer report needs new messages too.
  const pageNumbers = Array.from({ length: Math.min(pages, PAGE_KEYS.length) }, (_, i) => i + 1);

  return (
    <section aria-labelledby="report" className="mx-auto max-w-6xl overflow-x-clip px-4 py-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-sand-soft px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-brand-accent-foreground uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {t("eyebrow")}
          </p>
          <h2
            id="report"
            className="mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            {t.rich("title", { mark: (chunks) => <Underlined>{chunks}</Underlined> })}
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">{t("text")}</p>

          <ol aria-label={t("contents")} className="mt-6 border-t">
            {CHAPTERS.map(({ key, page, pages: range }) => (
              <li key={key} className="border-b">
                <button
                  type="button"
                  onClick={(e) => open(page, e.currentTarget)}
                  className="grid w-full grid-cols-[4.2rem_minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-1 py-2.5 text-left transition hover:bg-mint-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="text-xs font-semibold text-brand-accent-foreground tabular-nums">
                    {t("pageShort", { pages: range })}
                  </span>
                  <span className="font-semibold">
                    {t(`chapters.${key}.title`)}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {t(`chapters.${key}.text`)}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground" aria-hidden>
                    {t("see")} →
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              size="lg"
              className="h-12 rounded-xl px-5 text-base"
              onClick={(e) => open(1, e.currentTarget)}
            >
              <Eye aria-hidden />
              {t("open")}
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-5 text-base">
              <a href={pdf} download>
                <Download aria-hidden />
                {t("download", { pages, kb: pdfKb })}
              </a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => open(1, e.currentTarget)}
            aria-label={t("openLabel", { pages })}
            className="group relative mx-auto block aspect-[1/1.02] w-full max-w-[34rem] cursor-zoom-in rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="absolute inset-x-[2%] top-[6%] bottom-0 rounded-full bg-[radial-gradient(closest-side,var(--mint-soft),transparent)]"
            />
            {SHEETS.map(({ page, className }) => (
              <span
                key={page}
                className={cn(
                  "absolute top-[4%] left-1/2 aspect-[210/297] w-[58%] origin-[50%_90%] overflow-hidden rounded-[4px] bg-white shadow-[0_1px_2px_rgb(23_33_29/0.1),0_12px_28px_-10px_rgb(23_33_29/0.32)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                  className,
                )}
              >
                <img
                  src={src(page, "small")}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </span>
            ))}
            <span className="absolute right-[8%] bottom-[6%] z-[5] inline-flex items-center gap-2 rounded-full bg-pine-deep px-3.5 py-2 text-sm font-semibold text-[#eaf2ec] shadow-lg">
              <Maximize2 className="size-4" aria-hidden />
              {t("badge", { pages })}
            </span>
          </button>
          {(["market", "profit", "costs"] as const).map((key, i) => (
            <span
              key={key}
              aria-hidden
              className={cn(
                "pointer-events-none absolute z-[6] flex items-center gap-2",
                ["top-[13%] left-0", "top-[44%] right-0 flex-row-reverse", "top-[70%] left-0"][i],
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full bg-brand-accent shadow-[0_0_0_4px_color-mix(in_oklch,var(--brand-accent),transparent_70%)]" />
              <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-md sm:text-sm">
                {t(`callouts.${key}`)}
              </span>
            </span>
          ))}
          <p className="mt-3 text-center text-sm text-muted-foreground">{t("caption")}</p>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="report-viewer"
        onClose={() => opener.current?.focus()}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/75"
      >
        <div className="absolute inset-3 mx-auto grid max-w-[74rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl bg-card sm:inset-4">
          <div className="flex items-center gap-3 border-b bg-background px-4 py-3">
            <h2 id="report-viewer" className="min-w-0 truncate font-semibold">
              {t("viewerTitle")}
            </h2>
            <span
              className="text-sm whitespace-nowrap text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {t("pageOf", { page: current, pages })}
            </span>
            <span className="flex-1" />
            <Button asChild variant="outline" className="h-10 rounded-lg">
              <a href={pdf} download>
                <Download aria-hidden />
                <span className="hidden sm:inline">{t("downloadShort")}</span>
                <span className="sr-only sm:hidden">{t("downloadShort")}</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-lg"
              onClick={() => dialog.current?.close()}
              aria-label={t("close")}
            >
              <X aria-hidden />
            </Button>
          </div>
          <div className="grid min-h-0 md:grid-cols-[13rem_minmax(0,1fr)]">
            <nav
              aria-label={t("pagesLabel")}
              className="hidden overflow-y-auto border-r p-3 md:grid md:content-start md:gap-3"
            >
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goTo(n)}
                  aria-current={current === n}
                  className={cn(
                    "grid gap-1.5 rounded-lg border-[1.5px] border-transparent p-1.5 text-left text-xs text-muted-foreground transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    current === n && "border-primary bg-mint-soft font-semibold text-foreground",
                  )}
                >
                  <img
                    src={src(n, "small")}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-[3px] bg-white shadow-sm"
                  />
                  {n}. {t(`pages.${pageKey(n)}.title`)}
                </button>
              ))}
            </nav>
            <div
              ref={scroller}
              tabIndex={0}
              className="relative overflow-y-auto px-4 pt-5 pb-10 sm:px-8"
            >
              {pageNumbers.map((n) => (
                <figure key={n} data-page={n} className="mx-auto mb-7 max-w-[52rem]">
                  <figcaption className="mb-2 text-sm font-semibold text-muted-foreground">
                    {t("pageTitle", { page: n, title: t(`pages.${pageKey(n)}.title`) })}
                  </figcaption>
                  <img
                    src={src(n, "large")}
                    alt={t(`pages.${pageKey(n)}.alt`)}
                    loading="lazy"
                    width={952}
                    height={1347}
                    className="h-auto w-full rounded-[4px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.1),0_12px_28px_-10px_rgb(0_0_0/0.35)]"
                  />
                </figure>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}
