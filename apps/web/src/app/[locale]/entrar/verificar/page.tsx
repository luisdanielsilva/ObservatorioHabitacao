import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { asLocale, initPageLocale } from "@/i18n/locale";

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
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader className="items-center text-center">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
          <CardTitle>{t("checkTitle")}</CardTitle>
          <CardDescription>{t("checkText")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
