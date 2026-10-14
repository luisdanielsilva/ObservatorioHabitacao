import { ArrowRight, FileDown, MapPin } from "lucide-react";
import { listSharedPhotos } from "@olhovivo/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { SharedResults } from "@/components/share/SharedResults";
import { Link } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { createFormatter } from "@/lib/format";
import { googleMapsUrl } from "@/lib/mapsLink";
import { loadSharedScenario } from "@/lib/report/shared";
import { withBasePath } from "@/lib/basePath";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/partilha/[token]">): Promise<Metadata> {
  const { locale, token } = await params;
  const shared = loadSharedScenario(token);
  if (!shared) return { robots: { index: false } };
  const t = await getTranslations({ locale: asLocale(locale), namespace: "share" });
  const title = t("sharedTitle", { name: shared.scenario.name });
  return {
    title,
    description: t("sharedIntro"),
    // Shared scenarios are personal: reachable by link, never indexed.
    robots: { index: false, follow: false },
    openGraph: { title, description: t("sharedIntro"), type: "article" },
    twitter: { card: "summary_large_image", title, description: t("sharedIntro") },
  };
}

export default async function SharedScenarioPage({
  params,
}: PageProps<"/[locale]/partilha/[token]">) {
  const locale = await initPageLocale(params);
  const { token } = await params;
  const shared = loadSharedScenario(token);
  if (!shared) notFound();

  const { data } = shared;
  const { state, output } = data;
  const t = await getTranslations("share");
  const te = await getTranslations("evaluate");
  const tp = await getTranslations("photos");
  // Only when the owner chose to show them (otherwise none are returned).
  const photos = listSharedPhotos(getDb(), token);
  const f = createFormatter(locale);
  const mapsUrl = googleMapsUrl(state.mapsUrl);

  const facts: [string, string][] = [
    [
      te("propertyType"),
      `${te(`types.${state.propertyType}`)}${state.bedrooms !== null ? ` T${state.bedrooms === 5 ? "5+" : state.bedrooms}` : ""}`,
    ],
    ...(state.areaM2 ? [[te("areaM2"), `${f.number(state.areaM2)} m²`] as [string, string]] : []),
    ...(data.breadcrumb.length
      ? [[t("report.location"), data.breadcrumb.join(" › ")] as [string, string]]
      : []),
    ...(state.askingPrice
      ? [[te("askingPrice"), f.euro(state.askingPrice)] as [string, string]]
      : []),
    ...(state.marketValue
      ? [[te("marketValue"), f.euro(state.marketValue)] as [string, string]]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <PageHeader title={t("sharedTitle", { name: data.name })} intro={t("sharedIntro")}>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/avaliar">
              {t("calculateYourOwn")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={withBasePath(`/api/partilha/${token}/pdf?lang=${locale}`)}>
              <FileDown />
              {t("downloadPdf")}
            </a>
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {mapsUrl && (
            <Button asChild variant="link" className="mt-2 h-auto px-0">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin />
                {te("openMaps")}
              </a>
            </Button>
          )}
          {output.opportunity && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{te(`opportunity.${output.opportunity.signal}`)}</Badge>
              <span className="text-muted-foreground">
                {te("opportunity.text", { diff: f.signedPercent(output.opportunity.difference) })}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {photos.length > 0 && (
        <section aria-labelledby="fotografias" className="space-y-3">
          <h2 id="fotografias" className="text-lg font-semibold">
            {tp("title")}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, i) => {
              const src = withBasePath(`/api/partilha/${token}/photos/${photo.id}`);
              return (
                <li key={photo.id} className="overflow-hidden rounded-md border">
                  <a href={src} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served only while shared */}
                    <img
                      src={src}
                      alt={tp("alt", { n: i + 1 })}
                      width={photo.width}
                      height={photo.height}
                      loading={i < 4 ? "eager" : "lazy"}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SharedResults
        output={output}
        deals={state.deals}
        state={state}
        params={data.parameters}
        startMonth={data.startMonth}
        paramsYear={data.parametersYear}
      />
    </div>
  );
}
