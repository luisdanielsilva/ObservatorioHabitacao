import { describe, expect, it } from "vitest";
import { ageOn, parseProfile } from "./profile";

const today = new Date("2026-10-17T12:00:00Z");

describe("parseProfile", () => {
  it("accepts a name alone", () => {
    expect(parseProfile({ name: "  Ana   Silva " }, today)).toEqual({
      ok: true,
      profile: { name: "Ana Silva", phone: null, birthDate: null },
    });
  });

  it("keeps a valid phone and date of birth", () => {
    expect(
      parseProfile({ name: "Ana", phone: "+351 912 345 678", birthDate: "1990-05-01" }, today),
    ).toEqual({
      ok: true,
      profile: { name: "Ana", phone: "+351 912 345 678", birthDate: "1990-05-01" },
    });
  });

  it("requires a name", () => {
    expect(parseProfile({ name: " " }, today)).toEqual({ ok: false, errors: ["name"] });
  });

  it("refuses phones that aren't numbers", () => {
    for (const phone of ["12345", "abc 912 345 678", "+351 912 345 678 999 999"]) {
      expect(parseProfile({ name: "Ana", phone }, today)).toEqual({ ok: false, errors: ["phone"] });
    }
  });

  it("refuses dates that don't exist or are in the future, and people under 16", () => {
    expect(parseProfile({ name: "Ana", birthDate: "1990-02-30" }, today)).toMatchObject({
      errors: ["birthDate"],
    });
    expect(parseProfile({ name: "Ana", birthDate: "2027-01-01" }, today)).toMatchObject({
      errors: ["birthDate"],
    });
    expect(parseProfile({ name: "Ana", birthDate: "2010-10-18" }, today)).toMatchObject({
      errors: ["tooYoung"],
    });
    expect(parseProfile({ name: "Ana", birthDate: "2010-10-17" }, today)).toMatchObject({
      ok: true,
    });
  });
});

describe("ageOn", () => {
  it("counts full years", () => {
    expect(ageOn("2000-10-18", today)).toBe(25);
    expect(ageOn("2000-10-17", today)).toBe(26);
    expect(ageOn("17/10/2000", today)).toBeNull();
  });
});
