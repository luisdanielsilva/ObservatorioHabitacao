import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const PILLS = ["free", "minute", "noCommitment"] as const;

/**
 * The home page's invitation to owners: what their home is worth (/vender), with a link to
 * Avaliar anúncio for a listing they have seen. Built on the brand colour; in the dark theme the
 * brand colour is light, so the banner darkens it there to keep the white text readable.
 */
export async function SellBanner() {
  const t = await getTranslations("home.sellBanner");
  return (
    <section
      aria-labelledby="sell-banner"
      className="rounded-3xl bg-linear-to-br from-primary to-[color-mix(in_oklch,var(--primary),black_25%)] p-6 text-white shadow-xl shadow-primary/20 sm:p-10 lg:p-12 dark:from-[color-mix(in_oklch,var(--primary),black_35%)] dark:to-[color-mix(in_oklch,var(--primary),black_55%)] dark:shadow-black/30"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center md:gap-12">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
            {t("eyebrow")}
          </p>
          <h2
            id="sell-banner"
            className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 max-w-xl text-base text-white/90 text-pretty sm:text-lg">
            {t("subtitle")}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {PILLS.map((key) => (
              <li
                key={key}
                className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium ring-1 ring-white/20"
              >
                {t(`pills.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 w-full rounded-xl bg-white px-6 text-base font-semibold text-primary shadow-md transition hover:-translate-y-0.5 hover:bg-white hover:shadow-xl focus-visible:border-white focus-visible:ring-white/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:w-auto dark:text-[color-mix(in_oklch,var(--primary),black_45%)]"
          >
            <Link href="/vender">
              {t("cta")} <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Link
            href="/avaliar"
            className="rounded-sm text-center text-sm font-medium underline underline-offset-4 hover:text-white/80 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            {t("evaluateLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
