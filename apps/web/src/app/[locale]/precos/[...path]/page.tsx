import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyntheticBadge } from "@/components/shared/SyntheticBadge";
import { AreaKpis } from "@/components/prices/AreaKpis";
import { getAreaPageData, type AreaPageData } from "@/components/prices/data";
import { formatPeriod } from "@/lib/period";
import { PriceTable } from "@/components/prices/PriceTable";
import { TrendChart } from "@/components/prices/TrendChart";
import { alternatesFor, localizedUrl } from "@/lib/urls";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { createFormatter } from "@/lib/format";

// Rendered on first visit, then cached and regenerated at most once a day (ISR).
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

type Params = PageProps<"/[locale]/precos/[...path]">["params"];

async function load(params: Params) {
  const { path } = await params;
  return getAreaPageData(getDb(), path.map(decodeURIComponent).join("/"));
}

/** "Porto (concelho)" when an area shares its parent's name, otherwise just the name. */
async function displayName(locale: AppLocale, data: AreaPageData) {
  const t = await getTranslations({ locale, namespace: "prices" });
  const parent = data.breadcrumb.at(-2);
  return parent && parent.name === data.area.name
    ? `${data.area.name} (${t(`levels.${data.area.level}`)})`
    : data.area.name;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const data = FEATURES.prices ? await load(params) : null;
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "prices" });
  const name = await displayName(locale, data);
  const place = data.breadcrumb
    .map((b) => b.name)
    .reverse()
    .join(", ");
  return {
    title: t("areaTitle", { area: name }),
    description: t("metaDescription", { area: place }),
    alternates: alternatesFor(locale, `/precos/${data.area.path}`),
  };
}

export default async function AreaPricesPage({ params }: { params: Params }) {
  if (!FEATURES.prices) notFound();
  const locale = await initPageLocale(params);
  const data = await load(params);
  if (!data) notFound();

  const t = await getTranslations("prices");
  const common = await getTranslations("common");
  const f = createFormatter(locale);
  const { area, breadcrumb, prices, series } = data;
  const name = await displayName(locale, data);
  const period = (p: string) => formatPeriod((key, values) => t(key, values), p);

  const synthetic = Boolean(prices.sale?.synthetic || prices.rent?.synthetic);
  const fallback = [prices.sale, prices.rent].find((r) => r && r.areaId !== area.id);
  const latestPeriod = prices.sale?.period ?? prices.rent?.period;

  const chartSummary = (points: { period: string; value: number }[]) => {
    const first = points[0];
    const last = points.at(-1);
    return first && last
      ? t("chartSummary", {
          from: f.euroPerM2(first.value),
          firstPeriod: period(first.period),
          to: f.euroPerM2(last.value),
          lastPeriod: period(last.period),
        })
      : t("noData");
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: t("title"), url: localizedUrl(locale, "/precos") },
      ...breadcrumb.map((b) => ({ name: b.name, url: localizedUrl(locale, `/precos/${b.path}`) })),
    ].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        // JSON-LD must be inline; "<" is escaped so area names cannot close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/precos" className="hover:text-foreground hover:underline">
              {t("title")}
            </Link>
          </li>
          {breadcrumb.map((b, i) => (
            <li key={b.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              {i === breadcrumb.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {b.name}
                </span>
              ) : (
                <Link href={`/precos/${b.path}`} className="hover:text-foreground hover:underline">
                  {b.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <PageHeader title={t("areaTitle", { area: name })} intro={t("areaIntro", { area: name })}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {synthetic ? (
            <SyntheticBadge />
          ) : (
            prices.sale && <span>{common("source", { source: "INE" })}</span>
          )}
          {latestPeriod && <span>{t("lastPeriod", { period: period(latestPeriod) })}</span>}
        </div>
      </PageHeader>

      {(prices.sale?.source === "ine_derived" || prices.rent?.source === "ine_derived") && (
        <p className="mb-4 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {t("derivedNote")}
        </p>
      )}

      {fallback && (
        <p className="mb-4 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {t("fallbackNote", { area: fallback.areaName })}
        </p>
      )}

      <AreaKpis prices={prices} f={f} />

      <div className="mt-6">
        <Button asChild>
          <Link href={{ pathname: "/avaliar", query: { area: String(area.id) } }}>
            {t("evaluateHere", { area: area.name })} <ArrowRight />
          </Link>
        </Button>
      </div>

      {(series.sale.length > 0 || series.rent.length > 0) && (
        <section aria-labelledby="trend" className="mt-10">
          <h2 id="trend" className="mb-3 text-lg font-semibold">
            {t("trend")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {series.sale.length > 0 && (
              <TrendChart
                title={t("chartSale")}
                summary={chartSummary(series.sale)}
                color="var(--chart-1)"
                points={series.sale.map((p) => ({ label: period(p.period), value: p.value }))}
              />
            )}
            {series.rent.length > 0 && (
              <TrendChart
                title={t("chartRent")}
                summary={chartSummary(series.rent)}
                color="var(--chart-4)"
                points={series.rent.map((p) => ({ label: period(p.period), value: p.value }))}
              />
            )}
          </div>
        </section>
      )}

      {data.children.length > 0 && (
        <section aria-labelledby="children" className="mt-10">
          <h2 id="children" className="mb-3 text-lg font-semibold">
            {t(`children.${area.level}`)}
          </h2>
          <Card className="py-0">
            <CardContent className="px-0 sm:px-2">
              <PriceTable rows={data.children} caption={t(`children.${area.level}`)} />
            </CardContent>
          </Card>
        </section>
      )}

      {data.neighbours.length > 1 && (
        <section aria-labelledby="neighbours" className="mt-10">
          <h2 id="neighbours" className="mb-3 text-lg font-semibold">
            {t("neighbours")}
          </h2>
          <Card className="py-0">
            <CardContent className="px-0 sm:px-2">
              <PriceTable rows={data.neighbours} caption={t("neighbours")} highlightId={area.id} />
            </CardContent>
          </Card>
        </section>
      )}

      <Disclaimer className="mt-10" />
    </div>
  );
}
