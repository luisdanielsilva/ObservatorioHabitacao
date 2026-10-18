import { users } from "@observatorio-habitacao/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contactos">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "contact" });
  return { title: t("title"), description: t("intro") };
}

/**
 * Contact (issue #3): a support request or a feature suggestion, in one form. `?tipo=sugestao`
 * opens it on the suggestion.
 */
export default async function Page({ params, searchParams }: PageProps<"/[locale]/contactos">) {
  await initPageLocale(params);
  const t = await getTranslations("contact");
  const { tipo } = await searchParams;
  const user = await getCurrentUser();
  const name = user
    ? (getDb().select({ name: users.name }).from(users).where(eq(users.id, user.id)).get()?.name ??
      "")
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={t("title")} intro={t("intro")} />
      <Card>
        <CardContent>
          <ContactForm
            defaults={{ name, email: user?.email ?? "" }}
            initialType={tipo === "sugestao" ? "feature" : "support"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
