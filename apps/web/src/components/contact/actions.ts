"use server";

import { clientIp, createContactRequest, rateLimit, users } from "@observatorio-habitacao/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/session";

/** As on the other SingleUseApps sites: 5 messages a day per network, 30 a day in all. */
const IP_LIMIT = { requests: 5, windowSeconds: 24 * 3600 };
const ALL_LIMIT = { requests: 30, windowSeconds: 24 * 3600 };

const Request = z.object({
  type: z.enum(["support", "feature"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
});

type Field = keyof z.infer<typeof Request>;

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "invalid" | "limit" | "error";
      fields?: Field[];
    };

/**
 * Support request or feature suggestion (issue #3): kept as a lead for the back-office
 * (Pedidos) and emailed to the team (CONTACT_EMAIL_TO, or the first of ADMIN_EMAILS).
 */
export async function sendContactRequest(
  _prev: ContactState,
  form: FormData,
): Promise<ContactState> {
  const values = Object.fromEntries(
    ["type", "name", "email", "title", "description"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  // A field people don't see: only bots fill it in. They are told it was sent.
  if (String(form.get("website") ?? "")) return { status: "sent" };

  const parsed = Request.safeParse(values);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path[0] as Field))];
    return { status: "invalid", fields };
  }

  const db = getDb();
  const ip = clientIp(await headers());
  const byIp = rateLimit(db, `contact:ip:${ip}`, IP_LIMIT.requests, IP_LIMIT.windowSeconds);
  if (!byIp.allowed) return { status: "limit" };
  const all = rateLimit(db, "contact:all", ALL_LIMIT.requests, ALL_LIMIT.windowSeconds);
  if (!all.allowed) return { status: "limit" };

  const user = await getCurrentUser();
  const r = parsed.data;
  let id: number;
  try {
    id = createContactRequest(db, {
      type: r.type,
      userId: user?.id ?? null,
      name: r.name,
      email: r.email,
      title: r.title,
      message: r.description,
    });
  } catch (error) {
    console.error("contact request not saved:", error);
    return { status: "error" };
  }

  // The request is saved; an email that fails is logged, and the team still sees it in Pedidos.
  const to =
    process.env.CONTACT_EMAIL_TO ??
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .find(Boolean);
  if (to) {
    const label = r.type === "support" ? "Suporte" : "Sugestão";
    try {
      await sendEmail({
        to,
        replyTo: r.email,
        subject: `[${label}] ${r.title}`,
        text:
          `${label} — pedido #${id}\n` +
          `Nome: ${r.name}\nEmail: ${r.email}\n` +
          `Conta: ${user ? `sim (${user.email})` : "não"}\n\n${r.description}\n`,
      });
    } catch (error) {
      console.error(`contact email for request #${id} failed:`, error);
    }
  }
  return { status: "sent" };
}

/**
 * The name and email a signed-in person's request starts with. The home page's contact box asks
 * for them when it first opens, so the page itself doesn't depend on the session.
 */
export async function contactDefaults(): Promise<{ name: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) return { name: "", email: "" };
  const name =
    getDb().select({ name: users.name }).from(users).where(eq(users.id, user.id)).get()?.name ?? "";
  return { name, email: user.email ?? "" };
}
