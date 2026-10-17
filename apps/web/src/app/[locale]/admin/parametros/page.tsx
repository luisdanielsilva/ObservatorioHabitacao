import { listParameterSets } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime, TableScroll, td, th } from "@/components/admin/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/parametros">): Promise<Metadata> =>
  adminMetadata(params, "params.title");

/** Versioned tax and financing parameters (WBS 8.3, 4.5.5). */
export default async function ParametersPage({ params }: PageProps<"/[locale]/admin/parametros">) {
  const locale = await initPageLocale(params);
  await requireAdmin(locale, "/admin/parametros");
  const t = await getTranslations("admin");
  const sets = listParameterSets(getDb());

  return (
    <div className="space-y-6">
      <PageHeader title={t("params.title")} intro={t("params.intro")} />
      <TableScroll>
        <thead>
          <tr>
            <th className={th}>{t("params.year")}</th>
            <th className={th}>{t("params.region")}</th>
            <th className={th}>{t("params.version")}</th>
            <th className={th}>{t("params.status")}</th>
            <th className={th}>{t("params.verified")}</th>
            <th className={th}>{t("params.created")}</th>
            <th className={th}>
              <span className="sr-only">{t("params.view")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id}>
              <td className={`${td} font-medium`}>{s.year}</td>
              <td className={td}>{t(`regions.${s.region}`)}</td>
              <td className={`${td} tabular-nums`}>v{s.version}</td>
              <td className={td}>
                <Badge variant={s.status === "active" ? "default" : "outline"}>
                  {t(`setStatus.${s.status}`)}
                </Badge>
              </td>
              <td className={td}>
                {s.verifiedBy ? (
                  t("params.verifiedBy", {
                    name: s.verifiedBy,
                    date: formatDateTime(s.verifiedAt, locale),
                  })
                ) : (
                  <span className="text-warning">{t("params.notVerified")}</span>
                )}
              </td>
              <td className={td}>{formatDateTime(s.createdAt, locale)}</td>
              <td className={td}>
                <Link
                  href={`/admin/parametros/${s.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {t("params.view")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </div>
  );
}
