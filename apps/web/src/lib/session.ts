import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export type CurrentUser = Session["user"];

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * The signed-in user, or a redirect to the sign-in page that comes back to `returnTo`
 * (a path without the locale prefix, e.g. "/conta").
 */
export async function requireUser(locale: AppLocale, returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const voltar = `${locale === "pt" ? "" : `/${locale}`}${returnTo}`;
    redirect({ href: { pathname: "/entrar", query: { voltar } }, locale });
  }
  return user!;
}

export async function requireAdmin(locale: AppLocale, returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(locale, returnTo);
  if (user.role !== "admin") redirect({ href: "/", locale });
  return user;
}
