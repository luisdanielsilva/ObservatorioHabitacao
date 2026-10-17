import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteAccount,
  exportUserData,
  getConsents,
  listUserLeads,
  setConsent,
  updateProfile,
  completeProfile,
} from "./account";
import { createDb, migrateDb, type Db } from "./client";
import { createScenario } from "./scenarios";
import { analyses, leads, parameterSets, scenarios, sessions, users } from "./schema";
import { seed } from "./seed";
import { createAnalysis } from "./store";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
  db.insert(users).values({ id: "ana", email: "ana@example.pt", name: "Ana" }).run();
  db.insert(sessions)
    .values({ sessionToken: "t", userId: "ana", expires: new Date(Date.now() + 1e6) })
    .run();
  createScenario(db, "ana", {
    name: "A",
    property: {},
    inputs: {},
    results: null,
    parameterSetId: db.select().from(parameterSets).get()!.id,
  });
  createAnalysis(db, { property: { askingPrice: 1 }, userId: "ana" });
  db.insert(leads)
    .values([
      { type: "sales_support", email: "ana@example.pt", name: "Ana", contactConsent: true },
      { type: "sales_support", email: "other@example.pt", name: "Rui", contactConsent: true },
    ])
    .run();
});

describe("account", () => {
  it("finds requests sent before signing up by email", () => {
    expect(listUserLeads(db, "ana", "ana@example.pt")).toHaveLength(1);
  });

  it("keeps a consent history and reports the latest choice", () => {
    expect(getConsents(db, "ana").marketing).toBe(false);
    setConsent(db, "ana", "marketing", true);
    setConsent(db, "ana", "marketing", false);
    setConsent(db, "ana", "analytics", true);
    expect(getConsents(db, "ana")).toEqual({ marketing: false, analytics: true, partners: false });
  });

  it("updates the profile", () => {
    updateProfile(db, "ana", { name: "Ana S.", locale: "en" });
    expect(db.select().from(users).where(eq(users.id, "ana")).get()).toMatchObject({
      name: "Ana S.",
      locale: "en",
    });
  });

  it("completes the profile with phone and birth date, and exports them", () => {
    completeProfile(db, "ana", {
      name: "Ana Silva",
      phone: "+351 912 345 678",
      birthDate: "1990-05-01",
    });
    const user = db.select().from(users).where(eq(users.id, "ana")).get()!;
    expect(user).toMatchObject({
      name: "Ana Silva",
      phone: "+351 912 345 678",
      birthDate: "1990-05-01",
    });
    expect(user.profileCompletedAt).toBeTruthy();
    expect(exportUserData(db, "ana")!.user).toMatchObject({ phone: "+351 912 345 678" });
  });

  it("exports the user's data without credentials", () => {
    const data = exportUserData(db, "ana")!;
    expect(data.user.email).toBe("ana@example.pt");
    expect(data.scenarios).toHaveLength(1);
    expect(data.analyses).toHaveLength(1);
    expect(data.requests).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('"sessionToken"');
  });

  it("deletes the account, cascades and anonymises", () => {
    expect(deleteAccount(db, "ana")).toBe(true);
    expect(db.select().from(users).all()).toHaveLength(0);
    expect(db.select().from(sessions).all()).toHaveLength(0);
    expect(db.select().from(scenarios).all()).toHaveLength(0);
    expect(db.select().from(analyses).get()?.userId).toBeNull();
    const anaLead = db
      .select()
      .from(leads)
      .all()
      .find((l) => l.name === null);
    expect(anaLead).toMatchObject({ email: null, phone: null, message: null });
    expect(
      db
        .select()
        .from(leads)
        .all()
        .some((l) => l.email === "other@example.pt"),
    ).toBe(true);
    expect(deleteAccount(db, "ana")).toBe(false);
  });
});
