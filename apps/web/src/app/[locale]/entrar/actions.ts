"use server";

import { clientIp, rateLimit } from "@olhovivo/db";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { getDb } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { safeReturnTo } from "@/lib/returnTo";

/** Sign-in emails: per address (to protect inboxes) and per IP (to protect the sender). */
const EMAIL_LIMIT = { requests: 5, windowSeconds: 3600 };
const IP_LIMIT = { requests: 20, windowSeconds: 3600 };

export async function signInWithEmail(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const redirectTo = safeReturnTo(form.get("voltar"), "/conta");
  const locale = await getLocale();

  const db = getDb();
  const ip = clientIp(await headers());
  const byEmail = rateLimit(
    db,
    `signin:email:${email.toLowerCase()}`,
    EMAIL_LIMIT.requests,
    EMAIL_LIMIT.windowSeconds,
  );
  const byIp = rateLimit(db, `signin:ip:${ip}`, IP_LIMIT.requests, IP_LIMIT.windowSeconds);
  if (!byEmail.allowed || !byIp.allowed) {
    redirect({ href: { pathname: "/entrar", query: { error: "RateLimited" } }, locale });
  }

  // Send the link without Auth.js's own redirect, then show the page in the user's language.
  await signIn("resend", { email, redirectTo, redirect: false });
  redirect({ href: "/entrar/verificar", locale });
}

export async function signInWithGoogle(form: FormData) {
  const redirectTo = safeReturnTo(form.get("voltar"), "/conta");
  await signIn("google", { redirectTo });
}
