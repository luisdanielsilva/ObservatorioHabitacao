"use server";

import {
  deleteAccount,
  deleteScenario,
  deleteValuation,
  getConsents,
  scenarioIdsOfUser,
  setConsent,
  updateProfile,
} from "@observatorio-habitacao/db";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { getDb } from "@/lib/db";
import { parseProfile, type ProfileError } from "@/lib/profile";
import { removeScenarioPhotos } from "@/lib/photos";
import { getCurrentUser } from "@/lib/session";
import { withBasePath } from "@/lib/basePath";

export async function deleteSavedScenario(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const ok = deleteScenario(getDb(), id, user.id);
  // The photo rows went with the scenario; remove their files too.
  if (ok) await removeScenarioPhotos(id);
  revalidatePath("/[locale]/conta", "page");
  return ok;
}

export async function deleteSavedValuation(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const ok = deleteValuation(getDb(), id, user.id);
  revalidatePath("/[locale]/conta", "page");
  return ok;
}

export type SettingsState = {
  status: "idle" | "saved" | "invalid" | "error";
  errors?: ProfileError[];
  /** What was typed, put back after an error (React clears the form after an action). */
  values?: { name: string; phone: string; birthDate: string };
};

export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error" };
  const db = getDb();
  const values = {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    birthDate: String(form.get("birthDate") ?? ""),
  };
  // Name, phone and date of birth as on the profile page; emptying phone or date deletes them.
  const parsed = parseProfile(values);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values };
  const locale = form.get("locale") === "en" ? "en" : "pt";
  updateProfile(db, user.id, { ...parsed.profile, locale });

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
  const db = getDb();
  const scenarioIds = scenarioIdsOfUser(db, user.id);
  deleteAccount(db, user.id);
  await Promise.all(scenarioIds.map(removeScenarioPhotos));
  await signOut({ redirectTo: withBasePath("/") });
  return { status: "idle" };
}

export async function signOutAction() {
  await signOut({ redirectTo: withBasePath("/") });
}
