import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "../client";
import { getAreaByPath } from "../queries";
import { areaBoundaries, areas, marketStats } from "../schema";
import { seed } from "../seed";
import { findAreaByPoint, getMarketReference } from "../store";
import {
  importCaopFeatures,
  matchParishName,
  mergeRegionIslands,
  normaliseName,
  type CaopFeature,
} from "./caop";
import { parseEcbSeries } from "./euribor";
import {
  centroid,
  parseGpkgGeometry,
  ringArea,
  simplifyLine,
  simplifyPolygons,
  toWgs84,
  type MultiPolygon,
} from "./geometry";
import {
  mapIneGeography,
  parseIneData,
  parseInePeriod,
  parseInePeriods,
  removeReplacedSyntheticRows,
  storeIneValues,
} from "./ine";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"));

// ── Geometry ────────────────────────────────────────────────────────────────

/** Builds a GeoPackage blob: GP header (little-endian, 32-byte envelope) + WKB. */
function gpkgBlob(srsId: number, polygons: MultiPolygon, withZ = false): Uint8Array {
  const parts: number[] = [];
  const u32 = (v: number) => {
    const b = new DataView(new ArrayBuffer(4));
    b.setUint32(0, v, true);
    parts.push(...new Uint8Array(b.buffer));
  };
  const f64 = (v: number) => {
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, v, true);
    parts.push(...new Uint8Array(b.buffer));
  };
  parts.push(0x47, 0x50, 0, 0b011);
  u32(srsId);
  for (let i = 0; i < 4; i++) f64(0);
  parts.push(1);
  u32(withZ ? 1006 : 6);
  u32(polygons.length);
  for (const polygon of polygons) {
    parts.push(1);
    u32(withZ ? 1003 : 3);
    u32(polygon.length);
    for (const ring of polygon) {
      u32(ring.length);
      for (const [x, y] of ring) {
        f64(x!);
        f64(y!);
        if (withZ) f64(99);
      }
    }
  }
  return new Uint8Array(parts);
}

const square = (x: number, y: number, size: number): number[][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

describe("geometry", () => {
  it("parses GeoPackage MultiPolygons, with or without Z", () => {
    const polygons = [[square(0, 0, 10)], [square(20, 20, 5), square(21, 21, 1)]];
    for (const withZ of [false, true]) {
      const parsed = parseGpkgGeometry(gpkgBlob(3763, polygons, withZ));
      expect(parsed.srsId).toBe(3763);
      expect(parsed.polygons).toEqual(polygons);
    }
  });

  it("projects CAOP coordinate systems to WGS 84", () => {
    const [lng, lat] = toWgs84(3763)([0, 0]);
    expect(lng).toBeCloseTo(-8.133108, 5);
    expect(lat).toBeCloseTo(39.668258, 5);
    const [mLng] = toWgs84(5016)([500_000, 3_600_000]); // UTM 28N central meridian
    expect(mLng).toBeCloseTo(-15, 6);
    expect(() => toWgs84(4326)).toThrow(/Unsupported/);
  });

  it("simplifies lines within tolerance", () => {
    const line = [
      [0, 0],
      [1, 0.1],
      [2, -0.1],
      [3, 5],
      [4, 0],
    ];
    expect(simplifyLine(line, 0.5)).toEqual([
      [0, 0],
      [2, -0.1],
      [3, 5],
      [4, 0],
    ]);
  });

  it("drops tiny islands but always keeps the main polygon", () => {
    const main = [square(0, 0, 1000)];
    const islet = [square(5000, 5000, 5)];
    expect(simplifyPolygons([islet, main], 15, 500)).toEqual([main]);
    expect(simplifyPolygons([[square(0, 0, 5)]], 15, 500)).toHaveLength(1);
  });

  it("computes area and centroid", () => {
    expect(ringArea(square(0, 0, 10))).toBe(100);
    expect(centroid([[square(0, 0, 10)], [square(100, 100, 2)]])).toEqual([5, 5]);
  });
});

// ── CAOP ────────────────────────────────────────────────────────────────────

describe("parish name matching", () => {
  const braga = [
    { code: "030349", name: "Braga (São Vicente)" },
    { code: "030351", name: "Braga (São Vítor)" },
    { code: "030364", name: "Braga (Maximinos, Sé e Cividade)" },
    { code: "030378", name: "Nogueiró e Tenões" },
  ];

  it("normalises accents, case and 'União das freguesias de'", () => {
    expect(normaliseName("União das freguesias de Nogueiró e Tenões")).toBe("nogueiro e tenoes");
  });

  it("matches seed names to CAOP names", () => {
    expect(matchParishName("São Vicente", braga, "Braga")).toBe("030349");
    expect(matchParishName("São Victor", braga, "Braga")).toBe("030351");
    expect(matchParishName("Maximinos, Sé e Cividade", braga, "Braga")).toBe("030364");
    expect(matchParishName("Nogueiró e Tenões", braga, "Braga")).toBe("030378");
    expect(matchParishName("Gualtar", braga, "Braga")).toBeUndefined();
  });
});

/** A small CAOP extract in TM06 metres around Lisbon (x ≈ −88 km, y ≈ −106 km). */
function lisbonFeatures(): CaopFeature[] {
  const f = (
    level: CaopFeature["level"],
    code: string | null,
    name: string,
    parentKey: string | null,
    polygons: MultiPolygon,
    region: CaopFeature["region"] = "continente",
    srsId = 3763,
  ): CaopFeature => ({ level, code, name, parentKey, region, srsId, polygons });
  return [
    f("district", "11", "Lisboa", null, [[square(-100_000, -120_000, 30_000)]]),
    f("municipality", "1106", "Lisboa", "11", [[square(-95_000, -112_000, 12_000)]]),
    f("parish", "110656", "Arroios", "1106", [[square(-90_000, -106_000, 2_000)]]),
    f("parish", "110665", "Santa Maria Maior", "1106", [[square(-88_000, -106_000, 2_000)]]),
    f("parish", "110601", "Ajuda", "1106", [[square(-94_000, -110_000, 2_000)]]),
    // Two Açores islands merge into the region.
    f("district", null, "Açores", null, [[square(600_000, 4_170_000, 10_000)]], "acores", 5015),
    f("district", null, "Açores", null, [[square(640_000, 4_170_000, 10_000)]], "acores", 5015),
    f(
      "municipality",
      "4203",
      "Ponta Delgada",
      "acores",
      [[square(601_000, 4_171_000, 5_000)]],
      "acores",
      5015,
    ),
  ];
}

describe("importCaopFeatures", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
    migrateDb(db);
    seed(db);
  });

  it("merges island features into one region feature", () => {
    const merged = mergeRegionIslands(lisbonFeatures());
    const acores = merged.filter((f) => f.region === "acores" && f.level === "district");
    expect(acores).toHaveLength(1);
    expect(acores[0]!.polygons).toHaveLength(2);
  });

  it("keeps seeded ids, adds codes and new areas, and removes unknown seed parishes", () => {
    const arroiosId = getAreaByPath(db, "lisboa/lisboa/arroios")!.id;
    const counts = importCaopFeatures(db, lisbonFeatures());
    expect(counts).toEqual({ seen: 7, new: 2, updated: 5 });

    const arroios = getAreaByPath(db, "lisboa/lisboa/arroios")!;
    expect(arroios).toMatchObject({ id: arroiosId, code: "110656" });
    expect(getAreaByPath(db, "lisboa/lisboa/ajuda")?.code).toBe("110601");
    expect(getAreaByPath(db, "acores/ponta-delgada")?.region).toBe("acores");
    // Seed parishes absent from this extract are gone; other districts are untouched.
    expect(getAreaByPath(db, "lisboa/lisboa/alvalade")).toBeUndefined();
    expect(getAreaByPath(db, "porto")?.code).toBe("13");

    expect(arroios.lat).toBeGreaterThan(38.6);
    expect(arroios.lat).toBeLessThan(38.8);
    expect(findAreaByPoint(db, arroios.lat!, arroios.lng!)?.id).toBe(arroiosId);
  });

  it("is idempotent", () => {
    importCaopFeatures(db, lisbonFeatures());
    const before = db.select().from(areas).all().length;
    expect(importCaopFeatures(db, lisbonFeatures())).toEqual({ seen: 7, new: 0, updated: 7 });
    expect(db.select().from(areas).all()).toHaveLength(before);
    expect(db.select().from(areaBoundaries).all()).toHaveLength(7);
  });
});

// ── INE ─────────────────────────────────────────────────────────────────────

describe("INE parsing", () => {
  it("maps period codes", () => {
    expect(parseInePeriod("S5A20261")).toBe("2026-Q1");
    expect(parseInePeriod("S7A2025")).toBe("2025");
    expect(parseInePeriod("S3A202608")).toBe("2026-08");
    expect(parseInePeriod("X")).toBeUndefined();
  });

  it("maps geography codes to CAOP codes and regions", () => {
    expect(mapIneGeography("1A01106")).toEqual({ code: "1106" });
    expect(mapIneGeography("1A0110656")).toEqual({ code: "110656" });
    expect(mapIneGeography("20")).toEqual({ region: "acores" });
    expect(mapIneGeography("30")).toEqual({ region: "madeira" });
    expect(mapIneGeography("PT")).toBeUndefined();
    expect(mapIneGeography("1A0")).toBeUndefined();
  });

  it("parses values and skips rows without one", () => {
    const values = parseIneData(fixture("ine-rent-2025.json"));
    expect(values).toContainEqual({ geocod: "1A01106", value: 16.88 });
    expect(values.find((v) => v.geocod === "1120310")).toBeUndefined(); // "-" in INE
  });

  it("reports INE errors", () => {
    expect(() => parseIneData({ Sucesso: { Falso: [{ Msg: "invalid Dim3" }] } })).toThrow(
      /invalid Dim3/,
    );
  });

  it("lists available periods from the metadata", () => {
    expect(parseInePeriods(fixture("ine-rent-meta.json"))).toEqual([
      "S7A2020",
      "S7A2021",
      "S7A2022",
      "S7A2023",
      "S7A2024",
      "S7A2025",
    ]);
  });
});

describe("storing INE values", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
    migrateDb(db);
    seed(db);
    importCaopFeatures(db, lisbonFeatures());
  });

  const rows = (path: string) =>
    db
      .select({
        period: marketStats.period,
        source: marketStats.source,
        synthetic: marketStats.synthetic,
      })
      .from(marketStats)
      .where(
        and(
          eq(marketStats.areaId, getAreaByPath(db, path)!.id),
          eq(marketStats.metric, "rent_eur_m2_median"),
        ),
      )
      .all();

  it("stores municipality, parish and region values and is idempotent", () => {
    const values = parseIneData(fixture("ine-rent-2025.json"));
    const first = storeIneValues(db, "rent_eur_m2_median", "2025", values);
    expect(first.new).toBe(4); // Lisboa, Arroios, Açores, Madeira (Porto parishes have no code here)
    const again = storeIneValues(db, "rent_eur_m2_median", "2025", values);
    expect(again).toMatchObject({ new: 0, updated: first.new });
  });

  it("replaces synthetic rows of the area and of parishes in covered municipalities", () => {
    storeIneValues(db, "rent_eur_m2_median", "2024", [{ geocod: "1A01106", value: 16 }]);
    storeIneValues(db, "rent_eur_m2_median", "2025", parseIneData(fixture("ine-rent-2025.json")));
    removeReplacedSyntheticRows(db, "rent_eur_m2_median");

    expect(rows("lisboa/lisboa").every((r) => r.source === "ine")).toBe(true);
    expect(rows("lisboa/lisboa/santa-maria-maior")).toEqual([]); // falls back to Lisboa
    expect(rows("lisboa").every((r) => r.synthetic)).toBe(true); // no district data in INE

    const reference = getMarketReference(
      db,
      getAreaByPath(db, "lisboa/lisboa/santa-maria-maior")!.id,
      "rent_eur_m2_median",
    )!;
    expect(reference).toMatchObject({ value: 16.88, period: "2025", synthetic: false });
    expect(reference.yearOnYear).toBeCloseTo(16.88 / 16 - 1, 10);
  });
});

// ── ECB ─────────────────────────────────────────────────────────────────────

describe("parseEcbSeries", () => {
  it("returns monthly values as fractions dated on the first of the month", () => {
    expect(parseEcbSeries(fixture("ecb-euribor-6m.json"))).toEqual([
      { date: "2026-07-01", value: 0.0264674 },
      { date: "2026-08-01", value: 0.0271333 },
      { date: "2026-09-01", value: 0.0292159 },
    ]);
  });
});
