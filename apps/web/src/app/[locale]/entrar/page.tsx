import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { googleEnabled } from "@/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, redirect } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/session";
import { safeReturnTo } from "@/lib/returnTo";
import { signInWithEmail, signInWithGoogle } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/entrar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "signIn" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/entrar">) {
  const locale = await initPageLocale(params);
  const t = await getTranslations("signIn");
  const footer = await getTranslations("footer");
  const query = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const prefix = locale === "pt" ? "" : `/${locale}`;
  const returnTo = safeReturnTo(first(query.voltar), `${prefix}/conta`);

  if (await getCurrentUser()) redirect({ href: "/conta", locale });

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {first(query.error) && (
            <Alert variant="destructive">
              <AlertDescription>{t("error")}</AlertDescription>
            </Alert>
          )}
          <form action={signInWithEmail} className="space-y-3">
            <input type="hidden" name="voltar" value={returnTo} />
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={200}
              />
            </div>
            <Button type="submit" className="w-full">
              {t("submit")}
            </Button>
          </form>
          {googleEnabled() && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-border" />
                {t("or")}
                <span className="h-px flex-1 bg-border" />
              </div>
              <form action={signInWithGoogle}>
                <input type="hidden" name="voltar" value={returnTo} />
                <Button type="submit" variant="outline" className="w-full">
                  {t("google")}
                </Button>
              </form>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {t("terms")}{" "}
            <Link href="/termos" className="underline">
              {footer("terms")}
            </Link>{" "}
            ·{" "}
            <Link href="/privacidade" className="underline">
              {footer("privacy")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
