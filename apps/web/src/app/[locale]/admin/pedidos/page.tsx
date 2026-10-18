import { listAdmins, listLeads } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime, TableScroll, td, th } from "@/components/admin/ui";
import { selectClass } from "@/components/shared/AreaPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/pedidos">): Promise<Metadata> => adminMetadata(params, "leads.title");

const STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
const TYPES = [
  "valuation",
  "sales_support",
  "negotiation",
  "partner",
  "support",
  "feature",
] as const;
const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.find((x) => x === (Array.isArray(v) ? v[0] : v));

/** Leads / CRM (WBS 8.4). */
export default async function LeadsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/pedidos">) {
  const locale = await initPageLocale(params);
  await requireAdmin(locale, "/admin/pedidos");
  const t = await getTranslations("admin");
  const query = await searchParams;
  const status = pick(STATUSES, query.estado);
  const type = pick(TYPES, query.tipo);
  const db = getDb();
  const leads = listLeads(db, { status, type });
  const admins = new Map(listAdmins(db).map((a) => [a.id, a.name ?? a.email]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("leads.title")} intro={t("leads.intro")} />

      {/* Plain GET form: filters work without JavaScript and can be bookmarked. */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1.5">
          <Label htmlFor="estado">{t("leads.status")}</Label>
          <select id="estado" name="estado" defaultValue={status ?? ""} className={selectClass}>
            <option value="">{t("leads.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`leadStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo">{t("leads.type")}</Label>
          <select id="tipo" name="tipo" defaultValue={type ?? ""} className={selectClass}>
            <option value="">{t("leads.all")}</option>
            {TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`leadType.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          {t("leads.filter")}
        </Button>
      </form>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("leads.noLeads")}</p>
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>{t("leads.created")}</th>
              <th className={th}>{t("leads.type")}</th>
              <th className={th}>{t("leads.status")}</th>
              <th className={th}>{t("leads.name")}</th>
              <th className={th}>{t("leads.area")}</th>
              <th className={th}>{t("leads.assignee")}</th>
              <th className={th}>
                <span className="sr-only">{t("leads.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className={`${td} tabular-nums`}>{l.id}</td>
                <td className={td}>{formatDateTime(l.createdAt, locale)}</td>
                <td className={td}>{t(`leadType.${l.type}`)}</td>
                <td className={td}>
                  <Badge variant={l.status === "new" ? "default" : "secondary"}>
                    {t(`leadStatus.${l.status}`)}
                  </Badge>
                </td>
                <td className={td}>
                  {l.name ?? t("none")}
                  <span className="block text-xs text-muted-foreground">{l.email ?? l.phone}</span>
                </td>
                <td className={td}>{l.areaName ?? t("none")}</td>
                <td className={td}>
                  {l.assigneeId ? (admins.get(l.assigneeId) ?? t("none")) : t("leads.unassigned")}
                </td>
                <td className={td}>
                  <Link
                    href={`/admin/pedidos/${l.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {t("leads.open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}
    </div>
  );
}
