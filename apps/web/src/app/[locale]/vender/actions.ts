"use server";

import { leads } from "@olhovivo/db";
import { z } from "zod";
import { getDb } from "@/lib/db";

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
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        areaId: parsed.data.areaId ?? null,
        message: parsed.data.message || null,
        contactConsent: true,
      })
      .run();
    return { status: "success" };
  } catch (error) {
    console.error("requestSalesSupport failed", error);
    return { status: "error" };
  }
}
