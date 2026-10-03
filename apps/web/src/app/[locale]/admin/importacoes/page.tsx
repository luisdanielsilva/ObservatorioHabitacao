import { jobsSummary, listIngestionJobs, listSources } from "@olhovivo/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { toggleSourceAction } from "@/app/[locale]/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime, TableScroll, td, th } from "@/components/admin/ui";
import { HelpTip } from "@/components/shared/HelpTip";
import { PageHeader } from "@/components/shared/PageHeader";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/importacoes">): Promise<Metadata> =>
  adminMetadata(params, "imports.title");

const COMMANDS = [
  "npm run import:all",
  "npm run import:caop",
  "npm run import:ine",
  "npm run import:euribor",
  "npm run import:imi",
];

/** Data sources and import monitoring (WBS 8.1, 8.2). */
export default async function ImportsPage({ params }: PageProps<"/[locale]/admin/importacoes">) {
  const locale = await initPageLocale(params);
  await requireAdmin(locale, "/admin/importacoes");
  const t = await getTranslations("admin");
  const db = getDb();
  const runs = listIngestionJobs(db);
  const sources = listSources(db);
  const queue = jobsSummary(db);

  const toggle = (id: number, field: "active" | "permitted", value: boolean, label: string) => (
    <form action={toggleSourceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <Button
        type="submit"
        size="sm"
        variant={value ? "default" : "outline"}
        aria-pressed={value}
        aria-label={label}
      >
        {value ? t("leads.yes") : t("leads.no")}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("imports.title")} intro={t("imports.intro")} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("imports.jobs")}</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("imports.noJobs")}</p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>{t("imports.kind")}</th>
                <th className={th}>{t("imports.source")}</th>
                <th className={th}>{t("imports.status")}</th>
                <th className={th}>{t("imports.started")}</th>
                <th className={th}>{t("imports.finished")}</th>
                <th className={th}>{t("imports.records")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(({ job, sourceName }) => (
                <tr key={job.id}>
                  <td className={`${td} tabular-nums`}>{job.id}</td>
                  <td className={`${td} font-mono text-xs`}>{job.kind}</td>
                  <td className={td}>{sourceName ?? t("none")}</td>
                  <td className={td}>
                    <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>
                      {t(`jobStatus.${job.status}`)}
                    </Badge>
                  </td>
                  <td className={td}>{formatDateTime(job.startedAt, locale)}</td>
                  <td className={td}>{formatDateTime(job.finishedAt, locale)}</td>
                  <td className={td}>
                    {t("imports.counts", {
                      seen: job.itemsSeen,
                      new: job.itemsNew,
                      updated: job.itemsUpdated,
                    })}
                    {job.error && (
                      <span className="mt-1 block max-w-md text-xs break-words text-destructive">
                        {t("imports.error")}: {job.error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1 text-lg font-semibold">
          {t("imports.sources")}
          <HelpTip label={t("imports.permitted")} text={t("imports.permittedHelp")} />
        </h2>
        <TableScroll>
          <thead>
            <tr>
              <th className={th}>{t("imports.sourceName")}</th>
              <th className={th}>{t("imports.sourceKind")}</th>
              <th className={th}>{t("imports.active")}</th>
              <th className={th}>{t("imports.permitted")}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  {s.name}
                  {s.baseUrl && (
                    <span className="block text-xs break-all text-muted-foreground">
                      {s.baseUrl}
                    </span>
                  )}
                </td>
                <td className={td}>{s.kind}</td>
                <td className={td}>
                  {toggle(s.id, "active", s.active, `${t("imports.active")}: ${s.name}`)}
                </td>
                <td className={td}>
                  {toggle(s.id, "permitted", s.permitted, `${t("imports.permitted")}: ${s.name}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("imports.queue")}</CardTitle>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("imports.noQueue")}</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {queue.map((q) => (
                  <div key={`${q.type}-${q.status}`} className="contents">
                    <dt className="text-muted-foreground">
                      <span className="font-mono text-xs">{q.type}</span> ·{" "}
                      {t(`jobStatus.${q.status}`)}
                    </dt>
                    <dd className="text-right tabular-nums">{q.count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("imports.commands")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("imports.commandsHelp")}</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {COMMANDS.join("\n")}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
