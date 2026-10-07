import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, sessions, users, verificationTokens } from "@olhovivo/db";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { rememberSignInLink } from "@/lib/devSignIn";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "user" | "admin";
      plan: "free" | "premium";
    };
  }
}

/** Emails in ADMIN_EMAILS (comma-separated) get the admin role when they sign in. */
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const providers: NextAuthConfig["providers"] = [
  // Email magic link. Without RESEND_API_KEY the link is written to the server log.
  Resend({
    apiKey: process.env.RESEND_API_KEY ?? "development",
    from: process.env.EMAIL_FROM ?? "OlhoVivo <noreply@olhovivo.pt>",
    async sendVerificationRequest({ identifier, url }) {
      rememberSignInLink(identifier, url);
      const host = new URL(url).host;
      await sendEmail({
        to: identifier,
        subject: "Entrar no OlhoVivo / Sign in to OlhoVivo",
        text: `Para entrar no OlhoVivo, abra este link (válido 24 horas):\n${url}\n\nTo sign in to OlhoVivo, open this link (valid for 24 hours):\n${url}\n\nSe não pediu este email, ignore-o. / If you did not ask for this email, ignore it.`,
        html: `<p>Para entrar no OlhoVivo (${escapeHtml(host)}), clique no link abaixo. É válido durante 24 horas.</p>
<p>To sign in to OlhoVivo, click the link below. It is valid for 24 hours.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#0e7c7b;color:#fff;border-radius:6px;text-decoration:none">Entrar / Sign in</a></p>
<p style="color:#666;font-size:12px">Se não pediu este email, ignore-o. / If you did not ask for this email, ignore it.</p>`,
      });
    },
  }),
];
// Google sign-in is enabled when its credentials are configured.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: { strategy: "database", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/entrar", verifyRequest: "/entrar/verificar", error: "/entrar" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      const u = user as typeof user & { role: "user" | "admin"; plan: "free" | "premium" };
      session.user.id = u.id;
      session.user.role = u.role;
      session.user.plan = u.plan;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email && adminEmails().includes(user.email.toLowerCase())) {
        getDb().update(users).set({ role: "admin" }).where(eq(users.id, user.id)).run();
      }
    },
  },
});

export const googleEnabled = () =>
  Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
