import { MailCheck } from "lucide-react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { DEV_LINK_COOKIE, decodeSignInLink, showSignInLinks } from "@/lib/devSignIn";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/entrar/verificar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "signIn" });
  return { title: t("checkTitle"), robots: { index: false } };
}

/** Shown after a magic link was requested. */
export default async function VerifyPage({ params }: PageProps<"/[locale]/entrar/verificar">) {
  await initPageLocale(params);
  const t = await getTranslations("signIn");
  const stored = showSignInLinks() ? (await cookies()).get(DEV_LINK_COOKIE)?.value : undefined;
  const devLink = stored ? decodeSignInLink(stored) : null;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader className="items-center text-center">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
          <CardTitle as="h1">{t("checkTitle")}</CardTitle>
          <CardDescription>{t("checkText")}</CardDescription>
          {devLink && (
            // Development only, without an email provider: the email is not sent.
            <p className="mt-4 rounded-md border border-dashed p-3 text-sm">
              Desenvolvimento: o email não é enviado.{" "}
              <a href={devLink} className="font-medium text-primary underline">
                Entrar com o link (dev)
              </a>
            </p>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
