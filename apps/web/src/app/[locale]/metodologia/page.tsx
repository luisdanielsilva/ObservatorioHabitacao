import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { alternatesFor } from "@/lib/urls";

const METRICS = [
  "netProfit",
  "irr",
  "roi",
  "monthlyCashFlow",
  "grossYield",
  "netYield",
  "paybackYears",
  "returnOnDeposit",
  "totalInvestment",
  "ownCapital",
  "peakCapital",
  "acquisitionCosts",
] as const;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/metodologia">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "methodology" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternatesFor(asLocale(locale), "/metodologia"),
  };
}

/** Plain-language explanation of the calculations (WBS 9.1.2) and FAQ (WBS 12.2.1). */
export default async function MethodologyPage({ params }: PageProps<"/[locale]/metodologia">) {
  await initPageLocale(params);
  const t = await getTranslations("methodology");
  const tm = await getTranslations("metrics");
  const ts = await getTranslations("scenarios");

  const sections = [
    ["cenarios", t("scenariosTitle")],
    ["indicadores", t("metricsTitle")],
    ["compra", t("acquisitionTitle")],
    ["financiamento", t("financingTitle")],
    ["impostos", t("taxesTitle")],
    ["venda", t("exitTitle")],
    ["dados", t("dataTitle")],
    ["pressupostos", t("assumptionsTitle")],
    ["limites", t("simplificationsTitle")],
    ["perguntas", t("faqTitle")],
  ] as const;
  const list = (key: "assumptionsList" | "simplificationsList" | "notModelledList") =>
    t.raw(key) as string[];
  const faq = t.raw("faq") as { q: string; a: string }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={t("title")} intro={t("intro")} />

      <nav aria-labelledby="toc" className="mb-10 rounded-xl border bg-card p-5">
        <h2 id="toc" className="mb-2 text-sm font-semibold">
          {t("contents")}
        </h2>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {sections.map(([id, title]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-12 leading-relaxed">
        <section className="space-y-4">
          <H2 id="cenarios">{t("scenariosTitle")}</H2>
          <p className="text-muted-foreground">{t("scenariosIntro")}</p>
          <dl className="space-y-4">
            {(
              [
                ["flip", "scenarioFlip"],
                ["longTermRental", "scenarioLongTerm"],
                ["shortTermRental", "scenarioShortTerm"],
                ["contractAssignment", "scenarioCessao"],
              ] as const
            ).map(([kind, key]) => (
              <div key={kind}>
                <dt className="font-semibold">{ts(kind)}</dt>
                <dd className="text-muted-foreground">{t(key)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-4">
          <H2 id="indicadores">{t("metricsTitle")}</H2>
          <p className="text-muted-foreground">{t("metricsIntro")}</p>
          <dl className="divide-y rounded-xl border">
            {METRICS.map((key) => (
              <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                <dt className="font-medium">{tm(key)}</dt>
                <dd className="text-sm text-muted-foreground">{tm(`${key}Help`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <H2 id="compra">{t("acquisitionTitle")}</H2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("acquisitionImt")}</li>
            <li>{t("acquisitionNonResident")}</li>
            <li>{t("acquisitionStamp")}</li>
            <li>{t("acquisitionFees")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <H2 id="financiamento">{t("financingTitle")}</H2>
          <p className="text-muted-foreground">{t("financingText")}</p>
        </section>

        <section className="space-y-3">
          <H2 id="impostos">{t("taxesTitle")}</H2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("taxesRental")}</li>
            <li>{t("taxesAl")}</li>
            <li>{t("taxesGains")}</li>
            <li>{t("taxesCessao")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <H2 id="venda">{t("exitTitle")}</H2>
          <p className="text-muted-foreground">{t("exitText")}</p>
        </section>

        <section className="space-y-3">
          <H2 id="dados">{t("dataTitle")}</H2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {(["dataIne", "dataCaop", "dataEuribor", "dataImi", "dataOsm", "dataTax"] as const).map(
              (key) => (
                <li key={key}>{t(key)}</li>
              ),
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <H2 id="pressupostos">{t("assumptionsTitle")}</H2>
          <p className="text-muted-foreground">{t("assumptionsText")}</p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {list("assumptionsList").map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <H2 id="limites">{t("simplificationsTitle")}</H2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {list("simplificationsList").map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="pt-2 text-lg font-semibold">{t("notModelledTitle")}</h3>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {list("notModelledList").map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <H2 id="perguntas">{t("faqTitle")}</H2>
          <div className="space-y-2">
            {faq.map(({ q, a }) => (
              <details key={q} className="rounded-lg border px-4 py-3">
                <summary className="cursor-pointer font-medium">{q}</summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
          <p>
            <Link href="/contactos" className="text-primary underline">
              {t("contactsLink")}
            </Link>
          </p>
        </section>

        <Disclaimer />
      </div>
    </div>
  );
}
