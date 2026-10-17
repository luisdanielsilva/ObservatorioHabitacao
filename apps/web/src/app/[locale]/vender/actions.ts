"use server";

import { leads } from "@observatorio-habitacao/db";
import { z } from "zod";
import { getAreaBreadcrumb } from "@observatorio-habitacao/db";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { FEATURES } from "@/lib/features";
import { getCurrentUser } from "@/lib/session";

export type LeadState = { status: "idle" | "success" | "invalid" | "error" };

const leadSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.union([z.literal(""), z.email().max(200)]),
    phone: z.string().trim().max(40),
    areaId: z.coerce.number().int().positive().optional(),
    message: z.string().trim().max(4000),
    consent: z.literal("on"),
    // Honeypot: real people never fill this hidden field.
    website: z.literal(""),
  })
  .refine((v) => v.email !== "" || v.phone !== "");

/** Stores a sales-support request as a lead for the team (WBS 6.4.1). */
export async function requestSalesSupport(_prev: LeadState, form: FormData): Promise<LeadState> {
  if (!FEATURES.sell) return { status: "error" };
  const parsed = leadSchema.safeParse({
    name: form.get("name") ?? "",
    email: form.get("email") ?? "",
    phone: form.get("phone") ?? "",
    areaId: form.get("areaId") || undefined,
    message: form.get("message") ?? "",
    consent: form.get("consent"),
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return { status: "invalid" };

  try {
    getDb()
      .insert(leads)
      .values({
        type: "sales_support",
        userId: (await getCurrentUser())?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        areaId: parsed.data.areaId ?? null,
        message: parsed.data.message || null,
        contactConsent: true,
      })
      .run();
    await notifyTeam(parsed.data);
    return { status: "success" };
  } catch (error) {
    console.error("requestSalesSupport failed", error);
    return { status: "error" };
  }
}

/**
 * Tells the team about a new request (WBS 6.4.2) when TEAM_EMAIL is set. Failures are logged
 * and never affect the person's request, which is already stored.
 */
async function notifyTeam(lead: {
  name: string;
  email: string;
  phone: string;
  areaId?: number;
  message: string;
}) {
  const to = process.env.TEAM_EMAIL;
  if (!to) return;
  try {
    const area = lead.areaId
      ? getAreaBreadcrumb(getDb(), lead.areaId)
          .map((a) => a.name)
          .join(" › ")
      : "—";
    await sendEmail({
      to,
      subject: `Novo pedido de apoio à venda: ${lead.name}`,
      text: [
        `Nome: ${lead.name}`,
        `Email: ${lead.email || "—"}`,
        `Telefone: ${lead.phone || "—"}`,
        `Localização: ${area}`,
        "",
        lead.message || "(sem mensagem)",
        "",
        "Ver no back-office: /admin",
      ].join("\n"),
    });
  } catch (error) {
    console.error("lead notification failed", error);
  }
}
