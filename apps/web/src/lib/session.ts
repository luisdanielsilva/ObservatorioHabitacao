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
 * The signed-in user who has filled in their profile: what saving, sharing, photos and PDFs
 * need (issue #7). Someone signed in without a profile is treated as signed out there, and
 * the sign-in page sends them to fill it in.
 */
export async function getMember(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user?.profileComplete ? user : null;
}

/** The page that asks for the profile, coming back to `voltar` (a path with its locale prefix). */
export function profileHref(voltar: string) {
  return { pathname: "/conta/perfil" as const, query: { voltar } };
}

/**
 * The signed-in user with a profile, or a redirect to the sign-in page (or to the profile)
 * that comes back to `returnTo` (a path without the locale prefix, e.g. "/conta").
 */
export async function requireUser(locale: AppLocale, returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const voltar = `${locale === "pt" ? "" : `/${locale}`}${returnTo}`;
  if (!user) redirect({ href: { pathname: "/entrar", query: { voltar } }, locale });
  if (!user!.profileComplete) redirect({ href: profileHref(voltar), locale });
  return user!;
}

export async function requireAdmin(locale: AppLocale, returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(locale, returnTo);
  if (user.role !== "admin") redirect({ href: "/", locale });
  return user;
}
