import { ArrowRight, Building2, FileSignature, Home, KeyRound } from "lucide-react";
import { LinkBox } from "@/components/home/LinkBox";
import { getTranslations } from "next-intl/server";
import { initPageLocale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";

const SCENARIOS = [
  { key: "flip", icon: Building2, color: "text-chart-2" },
  { key: "longTermRental", icon: KeyRound, color: "text-chart-1" },
  { key: "shortTermRental", icon: Home, color: "text-chart-3" },
  { key: "contractAssignment", icon: FileSignature, color: "text-chart-4" },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  await initPageLocale(params);
  const t = await getTranslations("home");
  const ts = await getTranslations("scenarios");

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="mx-auto max-w-3xl py-14 text-center sm:py-20">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
          {t("subtitle")}
        </p>
        <div className="mt-8 text-left">
          <LinkBox />
        </div>
      </section>

      <section aria-labelledby="scenarios" className="py-8">
        <h2 id="scenarios" className="text-2xl font-semibold tracking-tight">
          {t("scenariosTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map(({ key, icon: Icon, color }) => (
            <Card key={key}>
              <CardHeader>
                <Icon className={`size-6 ${color}`} aria-hidden />
                <CardTitle as="h3" className="text-base">
                  {ts(key)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {ts(`${key}Text`)}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="py-12">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          {t("howTitle")}
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="space-y-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {n}
              </span>
              <h3 className="font-medium">{t(`step${n}Title`)}</h3>
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
  );
}
