import { ArrowRight, FileDown } from "lucide-react";
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
import { createFormatter } from "@/lib/format";
import { loadSharedScenario } from "@/lib/report/shared";

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
  const f = createFormatter(locale);

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
            <a href={`/api/partilha/${token}/pdf?lang=${locale}`}>
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
