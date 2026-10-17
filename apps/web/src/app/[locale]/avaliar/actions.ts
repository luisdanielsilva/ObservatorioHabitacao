"use server";

import {
  cacheGet,
  cacheSet,
  countScenarios,
  createScenario,
  duplicateScenario,
  getActiveParameterSet,
  setScenarioSharing,
  updateScenario,
} from "@observatorio-habitacao/db";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { entitlementsFor } from "@/lib/entitlements";
import { runCalculator } from "@/lib/calculator/run";
import { normaliseState } from "@/lib/calculator/state";
import { propertySnapshot, summariseOutput } from "@/lib/calculator/summary";
import { getMember, type CurrentUser } from "@/lib/session";
import { localizedUrl } from "@/lib/urls";

export type SaveResult =
  { status: "saved"; id: number } | { status: "signin" | "limit" | "invalid" | "error" };

const MAX_STATE_BYTES = 100_000;

/**
 * Saves the calculator state as a new scenario or over the user's existing one (WBS 6.3.2).
 * The state is normalised and the results recalculated on the server, never trusted as sent.
 */
export async function saveScenario(input: ScenarioInput): Promise<SaveResult> {
  const user = await getMember();
  if (!user) return { status: "signin" };
  return save(user, input);
}

interface ScenarioInput {
  id?: number | null;
  name: string;
  state: unknown;
}

function save(user: CurrentUser, input: ScenarioInput): SaveResult {
  if (JSON.stringify(input.state ?? null).length > MAX_STATE_BYTES) return { status: "invalid" };

  const db = getDb();
  const params = getActiveParameterSet(db, "continente", new Date().getFullYear());
  if (!params) return { status: "error" };

  const state = normaliseState(input.state);
  const name = input.name.trim().slice(0, 120) || "Cenário";
  try {
    const output = runCalculator(state, params.data, new Date().getMonth() + 1);
    const values = {
      name,
      property: propertySnapshot(state),
      inputs: state as unknown as Record<string, unknown>,
      results: summariseOutput(output) as unknown as Record<string, unknown>,
      parameterSetId: params.id,
    };

    if (input.id) {
      const updated = updateScenario(db, input.id, user.id, values);
      if (updated) return { status: "saved", id: updated.id };
    }
    if (countScenarios(db, user.id) >= entitlementsFor(user.plan).maxSavedScenarios) {
      return { status: "limit" };
    }
    return { status: "saved", id: createScenario(db, user.id, values).id };
  } catch (error) {
    console.error("saveScenario failed", error);
    return { status: "error" };
  }
}

export type ShareResult =
  | { status: "shared"; id: number; token: string }
  | { status: "signin" | "limit" | "invalid" | "error" };

/**
 * Saves the evaluation as on screen and turns its read-only link on (WBS 6.3.4): what is
 * shared is always what the user sees. The link stays the same across later saves.
 */
export async function shareScenario(input: ScenarioInput): Promise<ShareResult> {
  const user = await getMember();
  if (!user) return { status: "signin" };
  return share(user, input);
}

function share(user: CurrentUser, input: ScenarioInput): ShareResult {
  const saved = save(user, input);
  if (saved.status !== "saved") return saved;
  const token = setScenarioSharing(getDb(), saved.id, user.id, true);
  return token ? { status: "shared", id: saved.id, token } : { status: "error" };
}

export type EmailLinkResult =
  | { status: "sent"; id: number; token: string; email: string }
  | { status: "signin" | "limit" | "emailLimit" | "invalid" | "error" };

/** Emails sent per user and day (links and reports), to keep them from being used for spam. */
const DAILY_EMAILS = 10;

/** Shares the evaluation (see shareScenario) and emails the link to the account's address. */
export async function emailScenarioLink(
  input: ScenarioInput,
  locale: AppLocale,
): Promise<EmailLinkResult> {
  const user = await getMember();
  if (!user) return { status: "signin" };
  if (!user.email) return { status: "error" };

  const db = getDb();
  const key = `report-email:${user.id}:${new Date().toISOString().slice(0, 10)}`;
  const sent = cacheGet<number>(db, key) ?? 0;
  if (sent >= DAILY_EMAILS) return { status: "emailLimit" };

  const shared = share(user, input);
  if (shared.status !== "shared") return shared;
  try {
    const t = await getTranslations({ locale, namespace: "shareResults" });
    const name = input.name.trim().slice(0, 120) || "Cenário";
    await sendEmail({
      to: user.email,
      subject: t("emailSubject", { name }),
      text: t("emailText", { name, url: localizedUrl(locale, `/partilha/${shared.token}`) }),
    });
    cacheSet(db, key, sent + 1, 24 * 3600);
    return { ...shared, status: "sent", email: user.email };
  } catch (error) {
    console.error("emailScenarioLink failed", error);
    return { status: "error" };
  }
}

export async function duplicateSavedScenario(id: number, name: string): Promise<SaveResult> {
  const user = await getMember();
  if (!user) return { status: "signin" };
  const db = getDb();
  if (countScenarios(db, user.id) >= entitlementsFor(user.plan).maxSavedScenarios) {
    return { status: "limit" };
  }
  const copy = duplicateScenario(db, id, user.id, name.trim().slice(0, 120) || "Cópia");
  return copy ? { status: "saved", id: copy.id } : { status: "invalid" };
}
