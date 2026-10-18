import { getLead, listAdmins } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadForm } from "@/components/admin/LeadForm";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime } from "@/components/admin/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/pedidos/[id]">): Promise<Metadata> =>
  adminMetadata(params, "leads.title");

export default async function LeadPage({ params }: PageProps<"/[locale]/admin/pedidos/[id]">) {
  const locale = await initPageLocale(params);
  const { id } = await params;
  await requireAdmin(locale, `/admin/pedidos/${id}`);
  const t = await getTranslations("admin");
  const db = getDb();
  const found = getLead(db, Number(id));
  if (!found) notFound();
  const { lead, areaName } = found;
  const admins = listAdmins(db).map((a) => ({ id: a.id, label: a.name ?? a.email }));

  const field = (label: string, value: React.ReactNode) => (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || t("none")}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="text-sm text-muted-foreground hover:underline">
        ← {t("back")}
      </Link>
      <PageHeader title={t("leads.detail", { id: lead.id })}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge>{t(`leadStatus.${lead.status}`)}</Badge>
          <span>{t(`leadType.${lead.type}`)}</span>
          <span>· {formatDateTime(lead.createdAt, locale)}</span>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
            {field(t("leads.name"), lead.name)}
            {field(
              t("leads.email"),
              lead.email && (
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                  {lead.email}
                </a>
              ),
            )}
            {field(
              t("leads.phone"),
              lead.phone && (
                <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                  {lead.phone}
                </a>
              ),
            )}
            {field(t("leads.area"), areaName)}
            {field(t("leads.consent"), lead.contactConsent ? t("leads.yes") : t("leads.no"))}
            {typeof lead.payload?.title === "string" &&
              field(t("leads.subject"), lead.payload.title)}
            {field(
              t("leads.message"),
              lead.message && <span className="whitespace-pre-wrap">{lead.message}</span>,
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("leads.status")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm
            id={lead.id}
            status={lead.status}
            notes={lead.notes}
            assigneeId={lead.assigneeId}
            admins={admins}
          />
        </CardContent>
      </Card>
    </div>
  );
}
