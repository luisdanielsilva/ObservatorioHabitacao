"use server";

import {
  deleteAccount,
  deleteScenario,
  getConsents,
  setConsent,
  updateProfile,
} from "@olhovivo/db";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function deleteSavedScenario(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const ok = deleteScenario(getDb(), id, user.id);
  revalidatePath("/[locale]/conta", "page");
  return ok;
}

export type SettingsState = { status: "idle" | "saved" | "error" };

export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error" };
  const db = getDb();
  const name =
    String(form.get("name") ?? "")
      .trim()
      .slice(0, 120) || null;
  const locale = form.get("locale") === "en" ? "en" : "pt";
  updateProfile(db, user.id, { name, locale });

  // Consents are logged only when they change, keeping a meaningful history.
  const current = getConsents(db, user.id);
  for (const purpose of ["marketing", "partners"] as const) {
    const granted = form.get(purpose) === "on";
    if (current[purpose] !== granted) setConsent(db, user.id, purpose, granted);
  }
  revalidatePath("/[locale]/conta", "page");
  return { status: "saved" };
}

export type DeleteState = { status: "idle" | "mismatch" | "error" };

export async function deleteMyAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error" };
  const typed = String(form.get("confirm") ?? "")
    .trim()
    .toUpperCase();
  if (typed !== "APAGAR" && typed !== "DELETE") return { status: "mismatch" };
  deleteAccount(getDb(), user.id);
  await signOut({ redirectTo: "/" });
  return { status: "idle" };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
