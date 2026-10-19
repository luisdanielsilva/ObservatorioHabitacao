import { afterEach, describe, expect, it, vi } from "vitest";
import { canSave, entitlementsFor } from "./entitlements";

describe("entitlementsFor", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("free: no saving, 5 report emails an hour; paid: saving, a daily cap", () => {
    vi.stubEnv("ENFORCE_PLANS", "true");
    expect(entitlementsFor("free").maxSavedScenarios).toBe(0);
    expect(entitlementsFor("free").reportEmails).toEqual({ limit: 5, windowSeconds: 3600 });
    expect(canSave("free")).toBe(false);
    expect(canSave("premium")).toBe(true);
    expect(entitlementsFor("premium").reportEmails).toEqual({ limit: 50, windowSeconds: 86400 });
  });

  it("gives everyone the paid plan while plans are not enforced", () => {
    vi.stubEnv("ENFORCE_PLANS", "");
    expect(canSave("free")).toBe(true);
    expect(entitlementsFor("free")).toEqual(entitlementsFor("premium"));
  });
});
