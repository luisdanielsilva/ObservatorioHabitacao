import { ArrowRight, Building2, FileSignature, Home, KeyRound } from "lucide-react";
import { HomeExample } from "@/components/home/HomeExample";
import { LinkBox } from "@/components/home/LinkBox";
import { SellBanner } from "@/components/home/SellBanner";
import { getTranslations } from "next-intl/server";
import { initPageLocale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";

/** Each strategy in its own colour of the palette: pine, sand, moss and deep pine. */
const SCENARIOS = [
  { key: "flip", icon: Building2, bar: "bg-primary", tile: "bg-mint text-primary" },
  {
    key: "longTermRental",
    icon: KeyRound,
    bar: "bg-brand-accent-foreground",
    tile: "bg-sand-soft text-brand-accent-foreground",
  },
  { key: "shortTermRental", icon: Home, bar: "bg-moss", tile: "bg-moss-soft text-moss" },
  {
    key: "contractAssignment",
    icon: FileSignature,
    bar: "bg-pine-deep dark:bg-primary",
    tile: "bg-secondary text-pine-deep dark:text-primary",
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
  const ts = await getTranslations("scenarios");

  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-b from-muted/70 to-background">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-sand-soft px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-brand-accent-foreground uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t.rich("title", {
              mark: (chunks) => (
                <span className="relative whitespace-nowrap text-primary">
                  {chunks}
                  <svg
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    aria-hidden
                    className="absolute -bottom-[0.12em] -left-[2%] h-[0.3em] w-[104%]"
                  >
                    <path
                      d="M2 8 C 50 2, 120 2, 198 7"
                      className="stroke-brand-accent"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              ),
            })}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">
            {t("subtitle")}
          </p>
          <div className="mx-auto mt-9 max-w-3xl text-left">
            <LinkBox />
          </div>
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
        <section aria-labelledby="scenarios" className="py-14">
          <h2 id="scenarios" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("scenariosTitle")}
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENARIOS.map(({ key, icon: Icon, bar, tile }) => (
              <article
                key={key}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-background pb-5 transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className={`h-1.5 ${bar}`} aria-hidden />
                <div className={`mx-5 mt-5 grid size-12 place-items-center rounded-xl ${tile}`}>
                  <Icon className="size-6" aria-hidden />
                </div>
                <h3 className="mx-5 mt-4 font-semibold">{ts(key)}</h3>
                <p className="mx-5 mt-2 text-sm text-muted-foreground">{ts(`${key}Text`)}</p>
                <span
                  className={`mx-5 mt-4 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${tile}`}
                >
                  {t(`scenarioTags.${key}`)}
                </span>
              </article>
            ))}
          </div>
        </section>

        {FEATURES.sell && (
          <div className="pb-14">
            <SellBanner />
          </div>
        )}
      </div>

      {FEATURES.sell && <HomeExample />}

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
      </div>
    </>
  );
}

/** Sand contour lines and the logo's eyepiece, large and faint, behind the hero. */
function HeroBackdrop() {
  return (
    <>
      <svg
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      >
        <g fill="none" className="stroke-brand-accent" strokeOpacity="0.28" strokeWidth="1.2">
          <path d="M-20 420 C 160 360, 300 470, 470 410 S 760 330, 930 400 S 1150 470, 1240 420" />
          <path d="M-20 455 C 170 395, 310 505, 480 445 S 770 365, 940 435 S 1160 505, 1240 455" />
          <path d="M-20 490 C 180 430, 320 540, 490 480 S 780 400, 950 470 S 1170 540, 1240 490" />
          <path d="M-20 120 C 120 80, 260 150, 380 110 S 560 60, 640 95" />
          <path d="M-20 150 C 130 110, 270 180, 390 140 S 570 90, 650 125" />
        </g>
      </svg>
      <svg
        viewBox="0 0 32 32"
        aria-hidden
        fill="none"
        strokeLinecap="round"
        className="pointer-events-none absolute -top-16 -right-24 size-72 opacity-60 sm:size-[26rem]"
      >
        <circle
          cx="16"
          cy="16"
          r="11"
          className="stroke-primary"
          strokeOpacity="0.1"
          strokeWidth="0.8"
        />
        <circle
          cx="16"
          cy="16"
          r="7"
          className="stroke-brand-accent"
          strokeOpacity="0.22"
          strokeWidth="0.5"
        />
        <path
          d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5"
          className="stroke-brand-accent"
          strokeOpacity="0.45"
          strokeWidth="0.9"
        />
      </svg>
    </>
  );
}
