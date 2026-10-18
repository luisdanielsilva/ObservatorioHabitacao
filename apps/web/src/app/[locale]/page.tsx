import { ArrowRight, LifeBuoy, Lightbulb } from "lucide-react";
import { DonateSection } from "@/components/donate/DonateSection";
import { DistrictMap } from "@/components/home/DistrictMap";
import { HomeExample } from "@/components/home/HomeExample";
import { QuestionHero } from "@/components/home/QuestionHero";
import { ReportPreview } from "@/components/home/ReportPreview";
import { SellBanner } from "@/components/home/SellBanner";
import { getTranslations } from "next-intl/server";
import { initPageLocale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";

/** "Outras perguntas": each question in a colour of the palette, linked to what answers it. */
const QUESTIONS = [
  {
    key: "pricey",
    href: "/avaliar",
    colour: "text-primary bg-mint",
    hover: "hover:border-primary",
  },
  {
    key: "strategy",
    href: "/avaliar",
    colour: "text-moss bg-moss-soft",
    hover: "hover:border-moss",
  },
  {
    key: "costs",
    href: "/avaliar",
    colour: "text-brand-accent-foreground bg-sand-soft",
    hover: "hover:border-brand-accent",
  },
  {
    key: "breakEven",
    href: "/avaliar",
    colour: "text-pine-deep bg-secondary dark:text-primary",
    hover: "hover:border-pine-deep",
  },
  {
    key: "gainTax",
    href: "/vender",
    colour: "text-brand-accent-foreground bg-sand-soft",
    hover: "hover:border-brand-accent",
    sell: true,
  },
  {
    key: "proceeds",
    href: "/vender",
    colour: "text-primary bg-mint",
    hover: "hover:border-primary",
    sell: true,
  },
] as const;

const FACTS = [1, 2, 3, 4] as const;
const STEP_COLOURS = [
  "bg-primary text-sand-soft",
  "bg-[#2f7a5e] text-sand-soft",
  "bg-brand-accent text-pine-deep",
  "bg-pine-deep text-sand-soft dark:bg-moss dark:text-pine-deep",
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  await initPageLocale(params);
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");

  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-b from-mint-soft to-background">
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          {/* Behind the four situations on large screens; behind the top of the hero on phones. */}
          <DistrictMap className="pointer-events-none absolute top-4 left-1/2 h-[30rem] w-auto -translate-x-1/2 opacity-60 lg:top-1/2 lg:right-[23%] lg:left-auto lg:h-[96%] lg:translate-x-1/2 lg:-translate-y-1/2 lg:opacity-100" />
          <QuestionHero showSell={FEATURES.sell} />
        </div>
      </section>

      <section aria-label={t("factsLabel")} className="bg-pine-deep text-[#eaf2ec]">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-4 px-4 py-6 lg:grid-cols-4">
          {FACTS.map((n, i) => (
            <div
              key={n}
              className={`flex min-w-0 flex-col-reverse border-white/15 px-4 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0 ${i % 2 === 0 ? "pl-0" : "border-l"}`}
            >
              <dt className="text-sm opacity-85">{t(`facts.${n}`)}</dt>
              <dd className="text-xl font-bold text-brand-accent">{t(`facts.${n}v`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <section aria-labelledby="questions" className="py-14">
          <h2 id="questions" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("questions.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("questions.text")}</p>
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.filter((q) => FEATURES.sell || !("sell" in q)).map((q) => (
              <li key={q.key} className="min-w-0">
                <Link
                  href={q.href}
                  className={`flex h-full flex-col gap-2.5 rounded-2xl border bg-background p-5 transition hover:-translate-y-1 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${q.hover}`}
                >
                  <span
                    aria-hidden
                    className={`grid size-9 place-items-center rounded-lg text-lg font-bold ${q.colour}`}
                  >
                    ?
                  </span>
                  <h3 className="text-lg leading-snug font-semibold">
                    {t(`questions.items.${q.key}.q`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t(`questions.items.${q.key}.a`)}</p>
                  <span
                    className={`mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold ${q.colour.split(" ")[0]}`}
                  >
                    {q.href === "/vender" ? tn("sell") : tn("evaluate")}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {FEATURES.sell && (
          <div className="pb-14">
            <SellBanner />
          </div>
        )}
      </div>

      {FEATURES.sell && <HomeExample />}

      <ReportPreview />

      <div className="mx-auto max-w-6xl px-4">
        <section aria-labelledby="how" className="py-14">
          <h2 id="how" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("howTitle")}
          </h2>
          <ol className="relative mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* The steps' thread, from the first circle to the last. */}
            <span
              aria-hidden
              className="absolute top-5 right-[calc(25%-2.4rem)] left-5 hidden h-0.5 bg-[repeating-linear-gradient(90deg,var(--brand-accent)_0_8px,transparent_8px_14px)] lg:block"
            />
            {([1, 2, 3, 4] as const).map((n, i) => (
              <li key={n} className="relative space-y-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-full font-bold shadow-[0_0_0_6px_var(--background)] ${STEP_COLOURS[i]}`}
                >
                  {n}
                </span>
                <h3 className="pt-1 font-semibold">{t(`step${n}Title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`step${n}Text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {FEATURES.prices && (
          <section className="rounded-xl border bg-card p-8">
            <h2 className="text-2xl font-semibold tracking-tight">{t("pricesTitle")}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{t("pricesText")}</p>
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href="/precos">
                {t("pricesLink")} <ArrowRight />
              </Link>
            </Button>
          </section>
        )}

        {/* Help or an idea (issue #3), as at the bottom of the other SingleUseApps sites. */}
        <section
          aria-labelledby="contact"
          className="mb-14 flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="min-w-0">
            <h2 id="contact" className="text-xl font-semibold tracking-tight">
              {t("contactTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-muted-foreground">{t("contactText")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild>
              <Link href="/contactos">
                <LifeBuoy aria-hidden />
                {t("contactSupport")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={{ pathname: "/contactos", query: { tipo: "sugestao" } }}>
                <Lightbulb aria-hidden />
                {t("contactFeature")}
              </Link>
            </Button>
          </div>
        </section>

        <DonateSection />
      </div>
    </>
  );
}
