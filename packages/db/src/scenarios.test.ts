import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "./client";
import {
  countScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
  getScenario,
  getSharedScenario,
  listScenarios,
  setScenarioSharing,
  updateScenario,
} from "./scenarios";
import { parameterSets, users } from "./schema";
import { seed } from "./seed";

let db: Db;
let paramsId: number;
const input = (name: string) => ({
  name,
  property: { askingPrice: 200_000 },
  inputs: { marketValue: 210_000 },
  results: null,
  parameterSetId: paramsId,
});

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
  paramsId = db.select().from(parameterSets).get()!.id;
  db.insert(users)
    .values([
      { id: "ana", email: "ana@example.pt" },
      { id: "rui", email: "rui@example.pt" },
    ])
    .run();
});

describe("saved scenarios", () => {
  it("creates, lists and counts per user", () => {
    createScenario(db, "ana", input("A"));
    createScenario(db, "ana", input("B"));
    createScenario(db, "rui", input("C"));
    expect(countScenarios(db, "ana")).toBe(2);
    expect(
      listScenarios(db, "ana")
        .map((s) => s.name)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  it("never reads or changes another user's scenario", () => {
    const s = createScenario(db, "ana", input("A"));
    expect(getScenario(db, s.id, "rui")).toBeUndefined();
    expect(updateScenario(db, s.id, "rui", { name: "hacked" })).toBeUndefined();
    expect(duplicateScenario(db, s.id, "rui", "copy")).toBeUndefined();
    expect(deleteScenario(db, s.id, "rui")).toBe(false);
    expect(setScenarioSharing(db, s.id, "rui", true)).toBeUndefined();
    expect(getScenario(db, s.id, "ana")?.name).toBe("A");
  });

  it("updates and duplicates, keeping the link to the original", () => {
    const s = createScenario(db, "ana", input("A"));
    expect(updateScenario(db, s.id, "ana", { name: "A2" })?.name).toBe("A2");
    const copy = duplicateScenario(db, s.id, "ana", "A2 (cópia)")!;
    expect(copy).toMatchObject({
      name: "A2 (cópia)",
      duplicatedFromId: s.id,
      inputs: { marketValue: 210_000 },
    });
    expect(deleteScenario(db, s.id, "ana")).toBe(true);
    expect(getScenario(db, copy.id, "ana")?.duplicatedFromId).toBeNull();
  });

  it("shares through a token and revokes it", () => {
    const s = createScenario(db, "ana", input("A"));
    const token = setScenarioSharing(db, s.id, "ana", true)!;
    expect(token).toMatch(/^[\w-]{16}$/);
    expect(setScenarioSharing(db, s.id, "ana", true)).toBe(token); // stable while shared
    expect(getSharedScenario(db, token)?.id).toBe(s.id);
    expect(setScenarioSharing(db, s.id, "ana", false)).toBeNull();
    expect(getSharedScenario(db, token)).toBeUndefined();
    expect(getSharedScenario(db, "not-a-token")).toBeUndefined();
  });

  it("deletes a user's scenarios with the account", () => {
    createScenario(db, "ana", input("A"));
    db.delete(users).run();
    expect(countScenarios(db, "ana")).toBe(0);
  });
});
