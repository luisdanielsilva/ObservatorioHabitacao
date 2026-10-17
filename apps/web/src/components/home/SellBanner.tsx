import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const PILLS = ["free", "minute", "noCommitment"] as const;

/**
 * The home page's invitation to owners: what their home is worth (/vender), with a link to
 * Avaliar anúncio for a listing they have seen. Deep pine with sand highlights and the logo's
 * eyepiece as a watermark; in the dark theme the brand colour is light, so the banner darkens it.
 */
export async function SellBanner() {
  const t = await getTranslations("home.sellBanner");
  return (
    <section
      aria-labelledby="sell-banner"
      className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary to-pine-deep p-6 text-white shadow-xl shadow-pine-deep/30 sm:p-10 lg:p-12 dark:from-[color-mix(in_oklch,var(--primary),black_45%)] dark:to-pine-deep dark:shadow-black/30"
    >
      <LogoMark
        onDark
        className="pointer-events-none absolute -right-24 -bottom-28 size-80 opacity-12"
      />
      <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center md:gap-12">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-accent uppercase">
            {t("eyebrow")}
          </p>
          <h2
            id="sell-banner"
            className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl"
          >
            {t.rich("title", {
              em: (chunks) => <em className="text-brand-accent not-italic">{chunks}</em>,
            })}
          </h2>
          <p className="mt-3 max-w-xl text-base text-white/90 text-pretty sm:text-lg">
            {t("subtitle")}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {PILLS.map((key) => (
              <li
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-3 py-1 text-sm font-semibold text-pine-deep dark:bg-brand-accent"
              >
                <Check className="size-3.5 stroke-3 text-primary dark:text-pine-deep" aria-hidden />
                {t(`pills.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 w-full rounded-xl bg-brand-accent px-6 text-base font-semibold text-pine-deep shadow-md transition hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--brand-accent),white_18%)] hover:shadow-xl focus-visible:border-white focus-visible:ring-white/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:w-auto"
          >
            <Link href="/vender">
              {t("cta")} <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Link
            href="/avaliar"
            className="rounded-sm text-center text-sm font-medium underline decoration-brand-accent underline-offset-4 hover:text-brand-accent focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            {t("evaluateLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
