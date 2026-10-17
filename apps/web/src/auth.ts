import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, sessions, users, verificationTokens } from "@observatorio-habitacao/db";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { rememberSignInLink } from "@/lib/devSignIn";
import { withBasePath } from "@/lib/basePath";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "user" | "admin";
      plan: "free" | "premium";
      /** The profile asked for after the first sign-in is filled in (issue #7). */
      profileComplete: boolean;
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
    from: process.env.EMAIL_FROM ?? "Observatório Habitação <noreply@observatoriohabitacao.pt>",
    // The link is valid for 1 hour (decided by the owner, 2026-10-17).
    maxAge: 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      rememberSignInLink(identifier, url);
      const host = new URL(url).host;
      await sendEmail({
        to: identifier,
        subject: "Entrar no Observatório Habitação / Sign in to Observatório Habitação",
        text: `Para entrar no Observatório Habitação, abre este link (válido durante 1 hora):\n${url}\n\nTo sign in to Observatório Habitação, open this link (valid for 1 hour):\n${url}\n\nSe não pediste este email, ignora-o. / If you did not ask for this email, ignore it.`,
        html: `<p>Para entrar no Observatório Habitação (${escapeHtml(host)}), clica no link abaixo. É válido durante 1 hora.</p>
<p>To sign in to Observatório Habitação, click the link below. It is valid for 1 hour.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#1e5b45;color:#fff;border-radius:6px;text-decoration:none">Entrar / Sign in</a></p>
<p style="color:#666;font-size:12px">Se não pediste este email, ignora-o. / If you did not ask for this email, ignore it.</p>`,
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
  // Signed in for 5 days (decided by the owner, 2026-10-17).
  session: { strategy: "database", maxAge: 5 * 24 * 3600 },
  // Auth.js reads and builds full addresses, so its paths include the site's base path.
  basePath: withBasePath("/api/auth"),
  pages: {
    signIn: withBasePath("/entrar"),
    verifyRequest: withBasePath("/entrar/verificar"),
    error: withBasePath("/entrar"),
  },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      const u = user as typeof user & {
        role: "user" | "admin";
        plan: "free" | "premium";
        profileCompletedAt: string | null;
      };
      session.user.id = u.id;
      session.user.role = u.role;
      session.user.plan = u.plan;
      session.user.profileComplete = Boolean(u.profileCompletedAt);
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
