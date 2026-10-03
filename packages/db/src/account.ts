import { desc, eq, or } from "drizzle-orm";
import type { Db } from "./client";
import { accounts, analyses, consents, leads, scenarios, sessions, users } from "./schema";

/** Requests the user sent: by account, or by the email they used before signing up. */
export function listUserLeads(db: Db, userId: string, email: string) {
  return db
    .select({
      id: leads.id,
      type: leads.type,
      status: leads.status,
      message: leads.message,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(or(eq(leads.userId, userId), eq(leads.email, email)))
    .orderBy(desc(leads.createdAt))
    .all();
}

export function listUserAnalyses(db: Db, userId: string) {
  return db
    .select()
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(100)
    .all();
}

export type ConsentPurpose = (typeof consents.$inferInsert)["purpose"];

/** Current consent per purpose (the latest row wins; no row = not granted). */
export function getConsents(db: Db, userId: string): Record<ConsentPurpose, boolean> {
  const rows = db
    .select()
    .from(consents)
    .where(eq(consents.userId, userId))
    .orderBy(desc(consents.id))
    .all();
  const current: Record<ConsentPurpose, boolean> = {
    marketing: false,
    analytics: false,
    partners: false,
  };
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.purpose)) continue;
    seen.add(r.purpose);
    current[r.purpose] = r.granted;
  }
  return current;
}

/** Records a consent change; the full history is kept as evidence (RGPD art. 7). */
export function setConsent(db: Db, userId: string, purpose: ConsentPurpose, granted: boolean) {
  db.insert(consents).values({ userId, purpose, granted }).run();
}

export function updateProfile(
  db: Db,
  userId: string,
  profile: { name?: string | null; locale?: "pt" | "en" },
) {
  db.update(users).set(profile).where(eq(users.id, userId)).run();
}

/**
 * Everything stored about a user, for the RGPD data export (art. 15 and 20). Session tokens
 * and OAuth tokens are left out: they are credentials, not personal data to hand out.
 */
export function exportUserData(db: Db, userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return undefined;
  return {
    exportedAt: new Date().toISOString(),
    user,
    linkedAccounts: db
      .select({ provider: accounts.provider, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .all(),
    consents: db.select().from(consents).where(eq(consents.userId, userId)).all(),
    scenarios: db.select().from(scenarios).where(eq(scenarios.userId, userId)).all(),
    analyses: db.select().from(analyses).where(eq(analyses.userId, userId)).all(),
    requests: db
      .select()
      .from(leads)
      .where(or(eq(leads.userId, userId), eq(leads.email, user.email)))
      .all(),
  };
}

/**
 * Deletes the account (RGPD art. 17). Scenarios, consents, sessions and linked accounts are
 * deleted with it (foreign-key cascade); analyses are kept anonymised; requests sent to the
 * team are anonymised, since the person asked to be forgotten.
 */
export function deleteAccount(db: Db, userId: string): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return false;
  db.transaction((tx) => {
    tx.update(leads)
      .set({ name: null, email: null, phone: null, message: null, payload: null, userId: null })
      .where(or(eq(leads.userId, userId), eq(leads.email, user.email)))
      .run();
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();
    tx.delete(users).where(eq(users.id, userId)).run();
  });
  return true;
}
