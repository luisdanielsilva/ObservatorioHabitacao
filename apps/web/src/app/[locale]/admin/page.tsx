import { getDashboardStats } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime, StatCard } from "@/components/admin/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { createFormatter } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> =>
  adminMetadata(params, "nav.dashboard");

/** Basic analytics (WBS 8.6). */
export default async function AdminDashboard({ params }: PageProps<"/[locale]/admin">) {
  const locale = await initPageLocale(params);
  await requireAdmin(locale, "/admin");
  const t = await getTranslations("admin");
  const f = createFormatter(locale);
  const stats = getDashboardStats(getDb());
  const totalLeads = Object.values(stats.leadsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.dashboard")} intro={t("dashboard.intro")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.users")}
          value={f.number(stats.users.total)}
          detail={
            <>
              {t("dashboard.usersLast30", { count: stats.users.last30Days })}
              <br />
              {t("dashboard.admins", { count: stats.users.admins, premium: stats.users.premium })}
            </>
          }
        />
        <StatCard
          title={t("dashboard.scenarios")}
          value={f.number(stats.scenarios.total)}
          detail={t("dashboard.scenariosShared", { count: stats.scenarios.shared })}
        />
        <StatCard title={t("dashboard.analyses")} value={f.number(stats.analyses)} />
        <StatCard title={t("dashboard.leads")} value={f.number(totalLeads)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.leadsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              {Object.entries(stats.leadsByStatus).map(([status, n]) => (
                <div key={status} className="contents">
                  <dt className="text-muted-foreground">
                    {t(`leadStatus.${status as keyof typeof stats.leadsByStatus}`)}
                  </dt>
                  <dd className="text-right tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.leadsByDistrict")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.leadsByDistrict.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {stats.leadsByDistrict.map((d) => (
                  <div key={d.district} className="contents">
                    <dt className="text-muted-foreground">{d.district}</dt>
                    <dd className="text-right tabular-nums">{d.count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.events")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.eventsByType.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noEvents")}</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {stats.eventsByType.map((e) => (
                  <div key={e.type} className="contents">
                    <dt className="font-mono text-xs text-muted-foreground">{e.type}</dt>
                    <dd className="text-right tabular-nums">{f.number(e.count)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.imports")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.lastImport ? (
              <p>
                {t("dashboard.lastImport", {
                  kind: stats.lastImport.kind,
                  status: t(`jobStatus.${stats.lastImport.status as "queued"}`),
                  date: formatDateTime(stats.lastImport.finishedAt, locale),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("dashboard.noImports")}</p>
            )}
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              {stats.importJobs.map((j) => (
                <div key={j.status} className="contents">
                  <dt className="text-muted-foreground">
                    {t(`jobStatus.${j.status as "queued"}`)}
                  </dt>
                  <dd className="text-right tabular-nums">{j.count}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
