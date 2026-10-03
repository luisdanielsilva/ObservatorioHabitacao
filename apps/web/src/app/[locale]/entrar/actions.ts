"use server";

import { getLocale } from "next-intl/server";
import { signIn } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { safeReturnTo } from "@/lib/returnTo";

export async function signInWithEmail(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const redirectTo = safeReturnTo(form.get("voltar"), "/conta");
  // Send the link without Auth.js's own redirect, then show the page in the user's language.
  await signIn("resend", { email, redirectTo, redirect: false });
  redirect({ href: "/entrar/verificar", locale: await getLocale() });
}

export async function signInWithGoogle(form: FormData) {
  const redirectTo = safeReturnTo(form.get("voltar"), "/conta");
  await signIn("google", { redirectTo });
}
