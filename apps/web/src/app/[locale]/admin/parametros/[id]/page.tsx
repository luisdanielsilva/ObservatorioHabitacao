import { getParameterSetById } from "@olhovivo/db";
import type { ImtBracket } from "@olhovivo/engine";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminMetadata } from "@/components/admin/metadata";
import { ActivateForm, DraftForm, VerifyForm } from "@/components/admin/ParameterForms";
import { formatDateTime, TableScroll, td, th } from "@/components/admin/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { createFormatter, type Formatter } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/parametros/[id]">): Promise<Metadata> =>
  adminMetadata(params, "params.title");

/** Flattens nested values to "a.b.c" paths, leaving out the IMT tables shown separately. */
function flatten(value: unknown, path = ""): [string, unknown][] {
  if (path === "imt.hpp" || path === "imt.secondary") return [];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, path ? `${path}.${k}` : k));
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  }
  return [[path, value]];
}

/** Rates are fractions; amounts, years and thresholds are shown as plain numbers. */
function formatValue(path: string, value: unknown, f: Formatter): string {
  if (typeof value !== "number") return String(value);
  const isAmount = /year|minYears|transactionFees|Threshold/i.test(path);
  return !isAmount && value <= 1 ? f.percent(value, 3) : f.number(value, 2);
}

export default async function ParameterSetPage({
  params,
}: PageProps<"/[locale]/admin/parametros/[id]">) {
  const locale = await initPageLocale(params);
  const { id } = await params;
  await requireAdmin(locale, `/admin/parametros/${id}`);
  const t = await getTranslations("admin");
  const f = createFormatter(locale);
  const set = getParameterSetById(getDb(), Number(id));
  if (!set) notFound();

  const imtTable = (brackets: ImtBracket[]) => (
    <TableScroll className="min-w-0">
      <thead>
        <tr>
          <th className={th}>{t("params.upTo")}</th>
          <th className={th}>{t("params.rate")}</th>
          <th className={th}>{t("params.deduction")}</th>
        </tr>
      </thead>
      <tbody>
        {brackets.map((b, i) => (
          <tr key={i}>
            <td className={`${td} tabular-nums`}>
              {b.upTo === null ? t("params.openEnded") : f.euro(b.upTo)}
            </td>
            <td className={`${td} tabular-nums`}>{f.percent(b.rate, 2)}</td>
            <td className={`${td} tabular-nums`}>{f.number(b.deduction, 2)}</td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  );

  const region = t(`regions.${set.region}`);
  return (
    <div className="space-y-6">
      <Link href="/admin/parametros" className="text-sm text-muted-foreground hover:underline">
        ← {t("back")}
      </Link>
      <PageHeader title={t("params.setTitle", { year: set.year, region, version: set.version })}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={set.status === "active" ? "default" : "outline"}>
            {t(`setStatus.${set.status}`)}
          </Badge>
          {set.verifiedBy ? (
            <span>
              {t("params.verified")}:{" "}
              {t("params.verifiedBy", {
                name: set.verifiedBy,
                date: formatDateTime(set.verifiedAt, locale),
              })}
            </span>
          ) : (
            <span className="text-warning">{t("params.notVerified")}</span>
          )}
          <span>· {formatDateTime(set.createdAt, locale)}</span>
        </div>
      </PageHeader>

      {set.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("params.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
              {set.notes}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("params.imtTables")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium">{t("params.hpp")}</h3>
            {imtTable(set.data.imt.hpp)}
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium">{t("params.secondary")}</h3>
            {imtTable(set.data.imt.secondary)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("params.otherRates")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            {flatten(set.data).map(([path, value]) => (
              <div key={path} className="contents">
                <dt className="font-mono text-xs break-all text-muted-foreground">{path}</dt>
                <dd className="tabular-nums sm:text-right">{formatValue(path, value, f)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {!set.verifiedBy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("params.verify")}</CardTitle>
          </CardHeader>
          <CardContent>
            <VerifyForm id={set.id} />
          </CardContent>
        </Card>
      )}

      {set.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("params.activate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivateForm id={set.id} help={t("params.activateHelp", { year: set.year, region })} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("params.newDraft")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DraftForm json={JSON.stringify(set.data, null, 2)} />
        </CardContent>
      </Card>
    </div>
  );
}
