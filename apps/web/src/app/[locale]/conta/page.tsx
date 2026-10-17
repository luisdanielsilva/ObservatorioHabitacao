import {
  getConsents,
  listScenarios,
  listUserAnalyses,
  listUserLeads,
  listValuations,
  users,
} from "@observatorio-habitacao/db";
import type { ScenarioKind } from "@observatorio-habitacao/engine";
import { eq } from "drizzle-orm";
import { Download, ExternalLink, LogOut, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareControls } from "@/components/share/ShareControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";
import type { ResultsSummary } from "@/lib/calculator/summary";
import { getDb } from "@/lib/db";
import { createFormatter } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { signOutAction } from "./actions";
import {
  DeleteAccountForm,
  DeleteScenarioButton,
  DeleteValuationButton,
  SettingsForm,
} from "./AccountForms";
import { FEATURES } from "@/lib/features";
import { withBasePath } from "@/lib/basePath";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/conta">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/conta">) {
  const locale = await initPageLocale(params);
  const user = await requireUser(locale, "/conta");
  const t = await getTranslations("account");
  const ts = await getTranslations("scenarios");
  const f = createFormatter(locale);
  const db = getDb();

  const profile = db.select().from(users).where(eq(users.id, user.id)).get()!;
  const scenarios = listScenarios(db, user.id);
  const valuations = FEATURES.sell ? listValuations(db, user.id) : [];
  const analyses = listUserAnalyses(db, user.id);
  const requests = listUserLeads(db, user.id, user.email);
  const consents = getConsents(db, user.id);
  const date = (iso: string) =>
    new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString(locale === "en" ? "en-IE" : "pt-PT");

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <PageHeader title={t("title")} intro={t("intro")}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{t("signedInAs", { email: user.email })}</span>
          <Badge variant="outline">{t("plan", { plan: t(`plans.${user.plan}`) })}</Badge>
          {user.role === "admin" && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin">{t("admin")}</Link>
            </Button>
          )}
          <form action={signOutAction}>
            <Button type="submit" size="sm" variant="ghost">
              <LogOut />
              {(await getTranslations("signIn"))("signOut")}
            </Button>
          </form>
        </div>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("scenarios")}</CardTitle>
          <Button asChild size="sm">
            <Link href="/avaliar">
              <Plus />
              {t("newScenario")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noScenarios")}</p>
          ) : (
            <ul className="divide-y">
              {scenarios.map((s) => {
                const summary = s.results as ResultsSummary | null;
                // The deals evaluated in this scenario, without ranking them.
                const evaluated = Object.entries(summary?.scenarios ?? {})
                  .filter(([, figures]) => figures && !("missing" in figures))
                  .map(([kind]) => ts(kind as ScenarioKind));
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={{ pathname: "/avaliar", query: { cenario: String(s.id) } }}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t("updated", { date: date(s.updatedAt) })}
                        {evaluated.length > 0 && ` · ${evaluated.join(", ")}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <ShareControls scenarioId={s.id} name={s.name} size="sm" />
                      <Button asChild size="sm" variant="outline">
                        <Link href={{ pathname: "/avaliar", query: { cenario: String(s.id) } }}>
                          {t("open")}
                        </Link>
                      </Button>
                      <DeleteScenarioButton id={s.id} name={s.name} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {FEATURES.sell && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>{t("valuations")}</CardTitle>
            <Button asChild size="sm">
              <Link href="/vender">
                <Plus />
                {t("newValuation")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {valuations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noValuations")}</p>
            ) : (
              <ul className="divide-y">
                {valuations.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={{ pathname: "/vender", query: { avaliacao: String(v.id) } }}
                        className="font-medium hover:underline"
                      >
                        {v.name || t("valuations")}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t("updated", { date: date(v.updatedAt ?? v.createdAt) })} ·{" "}
                        {f.euro(v.likely)} ({f.euro(v.low)} – {f.euro(v.high)})
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <a
                          href={withBasePath(`/api/valuations/${v.id}/pdf?lang=${locale}`)}
                          target="_blank"
                          rel="noopener"
                        >
                          PDF
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={{ pathname: "/vender", query: { avaliacao: String(v.id) } }}>
                          {t("open")}
                        </Link>
                      </Button>
                      <DeleteValuationButton id={v.id} name={v.name} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("analyses")}</CardTitle>
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAnalyses")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {analyses.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {a.property.title ?? a.sourceDomain ?? "—"}
                      {a.property.askingPrice ? ` · ${f.euro(a.property.askingPrice)}` : ""}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {date(a.createdAt)}
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          aria-label={a.url}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("requests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRequests")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span>{t(`requestTypes.${r.type}`)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {date(r.createdAt)}
                      <Badge variant="secondary">{t(`requestStatus.${r.status}`)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            profile={{
              name: profile.name ?? "",
              phone: profile.phone ?? "",
              birthDate: profile.birthDate ?? "",
            }}
            locale={profile.locale}
            consents={{ marketing: consents.marketing, partners: consents.partners }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("privacy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Button asChild variant="outline">
              <a href={withBasePath("/api/account/export")} download>
                <Download />
                {t("export")}
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">{t("exportHelp")}</p>
          </div>
          <div className="space-y-2 border-t pt-6">
            <h3 className="font-medium text-destructive">{t("deleteAccount")}</h3>
            <DeleteAccountForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
