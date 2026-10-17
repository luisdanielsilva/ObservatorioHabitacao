import { users } from "@observatorio-habitacao/db";
import { eq } from "drizzle-orm";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect as nextRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getDb } from "@/lib/db";
import { safeReturnTo } from "@/lib/returnTo";
import { getCurrentUser } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/conta/perfil">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "profile" });
  return { title: t("title"), robots: { index: false } };
}

/**
 * After the first sign-in (issue #7): the free account is created, and this asks for the name
 * (required), the phone and the date of birth (optional) before going on to `voltar`. Someone
 * who has already filled it in goes on at once.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/[locale]/conta/perfil">) {
  const locale = await initPageLocale(params);
  const t = await getTranslations("profile");
  const query = await searchParams;
  const prefix = locale === "pt" ? "" : `/${locale}`;
  const voltar = safeReturnTo(
    Array.isArray(query.voltar) ? query.voltar[0] : query.voltar,
    `${prefix}/conta`,
  );

  const user = await getCurrentUser();
  if (!user) {
    const here = `${prefix}/conta/perfil?voltar=${encodeURIComponent(voltar)}`;
    redirect({ href: { pathname: "/entrar", query: { voltar: here } }, locale });
  }
  if (user!.profileComplete) nextRedirect(voltar);

  const profile = getDb().select().from(users).where(eq(users.id, user!.id)).get();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-2xl">
            {t("title")}
          </CardTitle>
          <CardDescription>{t("intro", { email: user!.email })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2 rounded-xl bg-mint-soft p-4 text-sm">
            {(["save", "pdf", "anywhere"] as const).map((key) => (
              <li key={key} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t(`benefits.${key}`)}
              </li>
            ))}
          </ul>
          <ProfileForm
            voltar={voltar}
            name={profile?.name ?? ""}
            phone={profile?.phone ?? ""}
            birthDate={profile?.birthDate ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
