import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, migrateDb } from "../client";
import { getAreaByPath } from "../queries";
import { areas } from "../schema";
import { seed } from "../seed";
import { aggregateRnal, parseRnalStats, rnalQueryUrl } from "./rnal";

const body = JSON.parse(
  readFileSync(new URL("./__fixtures__/rnal-stats.json", import.meta.url), "utf8"),
);

describe("parseRnalStats", () => {
  it("drops rows without a parish code and defaults missing capacity", () => {
    const groups = parseRnalStats(body);
    expect(groups).toHaveLength(4);
    expect(groups[3]).toEqual({
      parishCode: "030312",
      modality: "Moradia",
      establishments: 2,
      guests: 0,
    });
  });

  it("refuses truncated or failed responses", () => {
    expect(() => parseRnalStats({ ...body, exceededTransferLimit: true })).toThrow(/truncated/);
    expect(() => parseRnalStats({ error: { message: "bad" } })).toThrow(/bad/);
  });

  it("asks the server to aggregate by parish and modality", () => {
    const url = new URL(rnalQueryUrl());
    expect(url.searchParams.get("groupByFieldsForStatistics")).toBe("DTMNFR,Modalidade");
  });
});

describe("aggregateRnal", () => {
  it("sums parishes into municipalities and links known areas", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    seed(db);
    const arroios = getAreaByPath(db, "lisboa/lisboa/arroios")!.id;
    db.update(areas).set({ code: "110658" }).where(eq(areas.id, arroios)).run();

    const snapshot = aggregateRnal(db, parseRnalStats(body), "2026-10-03T00:00:00.000Z");
    expect(snapshot.totals).toEqual({
      establishments: 157,
      guests: 590,
      byModality: { Apartamento: 150, Quartos: 5, Moradia: 2 },
    });
    expect(snapshot.parishes["110658"]).toMatchObject({ areaId: arroios, establishments: 125 });
    expect(snapshot.municipalities["1106"]).toMatchObject({
      areaId: getAreaByPath(db, "lisboa/lisboa")!.id,
      establishments: 155,
    });
    expect(snapshot.unmatchedParishCodes.sort()).toEqual(["030312", "110601"]);
  });
});
