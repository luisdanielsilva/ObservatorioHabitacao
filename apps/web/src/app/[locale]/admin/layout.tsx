import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { asLocale } from "@/i18n/locale";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Back-office shell. Each page and server action checks the admin role again. */
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const locale = asLocale((await params).locale);
  await requireAdmin(locale, "/admin");
  const t = await getTranslations({ locale, namespace: "admin" });
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">{t("title")}</p>
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
