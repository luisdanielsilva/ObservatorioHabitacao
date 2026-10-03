"use server";

import {
  activateParameterSet,
  createParameterSetDraft,
  getParameterSetById,
  parameterSetSchema,
  setUserPlan,
  setUserRole,
  updateLead,
  updateSource,
  verifyParameterSet,
} from "@olhovivo/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Back-office actions. Each one checks the admin role itself: server actions are public
 * endpoints, so the page having checked it is not enough.
 */
async function adminOrThrow() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("forbidden");
  return user;
}

const refresh = () => revalidatePath("/[locale]/admin", "layout");
const intId = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export type FormState = {
  status: "idle" | "ok" | "error";
  errors?: string[];
  id?: number;
};

// ── Parameters ──────────────────────────────────────────────────────────────

export async function createDraftAction(_prev: FormState, form: FormData): Promise<FormState> {
  await adminOrThrow();
  let data: unknown;
  try {
    data = JSON.parse(String(form.get("json") ?? ""));
  } catch {
    return { status: "error", errors: ["json"] };
  }
  const parsed = parameterSetSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const notes =
    String(form.get("notes") ?? "")
      .trim()
      .slice(0, 5000) || undefined;
  const row = createParameterSetDraft(getDb(), parsed.data, notes);
  refresh();
  return { status: "ok", id: row.id };
}

export async function activateAction(_prev: FormState, form: FormData): Promise<FormState> {
  await adminOrThrow();
  const id = intId(form.get("id"));
  if (!id || form.get("confirm") !== "on") return { status: "error" };
  const db = getDb();
  // Only drafts can be activated; active and archived sets stay as they are.
  if (getParameterSetById(db, id)?.status !== "draft") return { status: "error" };
  activateParameterSet(db, id);
  refresh();
  revalidatePath("/[locale]/avaliar", "page");
  return { status: "ok", id };
}

export async function verifyAction(_prev: FormState, form: FormData): Promise<FormState> {
  await adminOrThrow();
  const id = intId(form.get("id"));
  const ok = id !== null && verifyParameterSet(getDb(), id, String(form.get("verifiedBy") ?? ""));
  if (ok) refresh();
  return { status: ok ? "ok" : "error" };
}

// ── Leads ───────────────────────────────────────────────────────────────────

const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;

export async function updateLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  await adminOrThrow();
  const id = intId(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!id || !(LEAD_STATUSES as readonly string[]).includes(status)) return { status: "error" };
  const assignee = String(form.get("assigneeId") ?? "");
  const ok = updateLead(getDb(), id, {
    status: status as (typeof LEAD_STATUSES)[number],
    notes: String(form.get("notes") ?? "").trim() || null,
    assigneeId: assignee || null,
  });
  if (ok) refresh();
  return { status: ok ? "ok" : "error" };
}

// ── Sources ─────────────────────────────────────────────────────────────────

export async function toggleSourceAction(form: FormData): Promise<void> {
  await adminOrThrow();
  const id = intId(form.get("id"));
  const field = form.get("field");
  if (!id || (field !== "active" && field !== "permitted")) return;
  updateSource(getDb(), id, { [field]: form.get("value") === "true" });
  refresh();
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function updateUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await adminOrThrow();
  const userId = String(form.get("userId") ?? "");
  const role = form.get("role");
  const plan = form.get("plan");
  if (!userId || (role !== "user" && role !== "admin") || (plan !== "free" && plan !== "premium")) {
    return { status: "error" };
  }
  if (userId === admin.id && role !== "admin") return { status: "error", errors: ["ownRole"] };
  const db = getDb();
  if (!setUserRole(db, admin.id, userId, role)) return { status: "error" };
  setUserPlan(db, userId, plan);
  refresh();
  return { status: "ok" };
}
