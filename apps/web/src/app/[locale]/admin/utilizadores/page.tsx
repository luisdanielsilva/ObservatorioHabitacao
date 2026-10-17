import { listUsers } from "@observatorio-habitacao/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminMetadata } from "@/components/admin/metadata";
import { formatDateTime, TableScroll, th } from "@/components/admin/ui";
import { UserRow } from "@/components/admin/UserRow";
import { PageHeader } from "@/components/shared/PageHeader";
import { initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = ({
  params,
}: PageProps<"/[locale]/admin/utilizadores">): Promise<Metadata> =>
  adminMetadata(params, "users.title");

/** User management (WBS 8.5). */
export default async function UsersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/utilizadores">) {
  const locale = await initPageLocale(params);
  const admin = await requireAdmin(locale, "/admin/utilizadores");
  const t = await getTranslations("admin");
  const { q } = await searchParams;
  const search = (Array.isArray(q) ? q[0] : q) ?? "";
  const users = listUsers(getDb(), search);

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} intro={t("users.intro")} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="q">{t("users.search")}</Label>
          <Input id="q" name="q" type="search" defaultValue={search} maxLength={100} />
        </div>
        <Button type="submit" variant="secondary">
          {t("users.searchButton")}
        </Button>
      </form>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("users.noUsers")}</p>
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <th className={th}>{t("users.email")}</th>
              <th className={th}>{t("users.created")}</th>
              <th className={th}>{t("users.role")}</th>
              <th className={th}>{t("users.plan")}</th>
              <th className={th}>
                <span className="sr-only">{t("users.save")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                created={formatDateTime(u.createdAt, locale)}
                isSelf={u.id === admin.id}
              />
            ))}
          </tbody>
        </TableScroll>
      )}
    </div>
  );
}
