"use server";

import { completeProfile } from "@observatorio-habitacao/db";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { parseProfile, type ProfileError } from "@/lib/profile";
import { safeReturnTo } from "@/lib/returnTo";
import { getCurrentUser } from "@/lib/session";

/** The errors, and what was typed: React clears the form after an action, so it's put back. */
export type ProfileState = {
  errors: ProfileError[];
  values?: { name: string; phone: string; birthDate: string };
};

/** Saves the profile and goes on to where the user was going. */
export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  const values = {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    birthDate: String(form.get("birthDate") ?? ""),
  };
  if (!user) return { errors: ["name"], values };
  const parsed = parseProfile(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  completeProfile(getDb(), user.id, parsed.profile);
  redirect(safeReturnTo(form.get("voltar"), "/conta"));
}
