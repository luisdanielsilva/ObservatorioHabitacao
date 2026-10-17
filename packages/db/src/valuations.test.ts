import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "./client";
import { deleteAccount, exportUserData } from "./account";
import { users } from "./schema";
import {
  countValuations,
  createValuation,
  deleteValuation,
  getValuation,
  listValuations,
  updateValuation,
} from "./valuations";

let db: Db;
const input = (name: string, likely = 300_000) => ({
  name,
  areaId: null,
  input: { areaM2: 100 },
  low: likely * 0.9,
  likely,
  high: likely * 1.1,
  eurPerM2: likely / 100,
  confidence: 0.65,
  modelVersion: "v1-test",
});

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  db.insert(users)
    .values([
      { id: "ana", email: "ana@example.pt" },
      { id: "rui", email: "rui@example.pt" },
    ])
    .run();
});

describe("saved valuations", () => {
  it("are created, listed newest first, updated and deleted by their owner only", () => {
    const a = createValuation(db, "ana", input("T2 em Arroios"));
    const b = createValuation(db, "ana", input("T3 em Benfica"));
    createValuation(db, "rui", input("Moradia"));
    expect(countValuations(db, "ana")).toBe(2);
    expect(a.updatedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);

    db.run(`update valuations set updated_at = '2020-01-01 00:00:00' where id = ${b.id}`);
    expect(listValuations(db, "ana").map((v) => v.name)).toEqual([
      "T2 em Arroios",
      "T3 em Benfica",
    ]);

    expect(updateValuation(db, a.id, "rui", input("x"))).toBeUndefined();
    expect(updateValuation(db, a.id, "ana", input("T2", 320_000))?.likely).toBe(320_000);
    expect(getValuation(db, a.id, "rui")).toBeUndefined();
    expect(getValuation(db, a.id, "ana")?.name).toBe("T2");

    expect(deleteValuation(db, a.id, "rui")).toBe(false);
    expect(deleteValuation(db, a.id, "ana")).toBe(true);
    expect(countValuations(db, "ana")).toBe(1);
  });

  it("are in the data export and deleted with the account", () => {
    createValuation(db, "ana", input("T2"));
    expect(exportUserData(db, "ana")?.valuations).toHaveLength(1);
    deleteAccount(db, "ana");
    expect(db.$client.prepare("select count(*) n from valuations").get()).toEqual({ n: 0 });
  });
});
