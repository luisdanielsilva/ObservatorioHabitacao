import { beforeEach, describe, expect, it } from "vitest";
import { findAreaByNames, normaliseAreaName } from "./areaNames";
import { createDb, migrateDb, type Db } from "./client";
import { seed } from "./seed";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
});

describe("findAreaByNames", () => {
  it("matches municipality and parish names without accents", () => {
    expect(findAreaByNames(db, "Lisboa", ["Arroios"])?.path).toBe("lisboa/lisboa/arroios");
    expect(findAreaByNames(db, "BRAGA", ["Sao Victor"])?.path).toBe("braga/braga/sao-victor");
  });

  it("matches one parish inside a union of parishes", () => {
    expect(findAreaByNames(db, "Braga", ["Sé"])?.path).toBe("braga/braga/maximinos-se-e-cividade");
  });

  it("falls back to the municipality, or nothing", () => {
    expect(findAreaByNames(db, "Porto", ["Atlantis"])?.path).toBe("porto/porto");
    expect(findAreaByNames(db, "Atlantis", [])).toBeUndefined();
  });
});

describe("normaliseAreaName", () => {
  it("drops the union prefix", () => {
    expect(normaliseAreaName("União das freguesias de Cascais e Estoril")).toBe(
      "cascais e estoril",
    );
  });
});
