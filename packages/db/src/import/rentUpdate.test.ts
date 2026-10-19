import { describe, expect, it } from "vitest";
import { createDb, migrateDb } from "../client";
import { getLatestReferenceRate } from "../store";
import { importRentUpdates, RENT_UPDATE_RATE } from "./rentUpdate";

describe("importRentUpdates", () => {
  it("stores the published coefficients once; the latest is the one in force", async () => {
    const db = createDb(":memory:");
    migrateDb(db);
    await importRentUpdates(db);
    await importRentUpdates(db);
    expect(getLatestReferenceRate(db, RENT_UPDATE_RATE)).toEqual({
      value: 0.0256,
      date: "2027-01-01",
      source: "Aviso n.º 24199/2026/2",
    });
  });
});
