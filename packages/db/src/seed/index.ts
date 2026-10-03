import type { Region } from "@olhovivo/engine";
import { count } from "drizzle-orm";
import type { Db } from "../client";
import { activateParameterSet, createParameterSetDraft } from "../queries";
import { alIndicators, alRules, areas, imiRates, marketStats, sources } from "../schema";
import {
  SEASONALITY,
  seedAlProfiles,
  seedAlRules,
  seedAreas,
  seedImiRates,
  type SeedArea,
} from "./data";
import { parameters2025 } from "./parameters2025";

/** "Carcavelos e Parede" → "carcavelos-e-parede". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The latest seeded quarter and how many quarters of history to generate. */
const LATEST_QUARTER = { year: 2026, quarter: 2 };
const QUARTERS = 12;
const ANNUAL_GROWTH = { sale: 0.07, rent: 0.05 };

function quarterLabel(stepsBack: number): string {
  const index = LATEST_QUARTER.year * 4 + (LATEST_QUARTER.quarter - 1) - stepsBack;
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`;
}

/** Deterministic history: steady growth back from the latest value, with a small wobble. */
function syntheticSeries(latest: number, growth: number, seed: number, decimals: number) {
  const factor = 10 ** decimals;
  return Array.from({ length: QUARTERS }, (_, stepsBack) => {
    const wobble = 1 + 0.012 * Math.sin(stepsBack * 1.7 + seed);
    const value = (latest / (1 + growth) ** (stepsBack / 4)) * (stepsBack === 0 ? 1 : wobble);
    return { period: quarterLabel(stepsBack), value: Math.round(value * factor) / factor };
  });
}

/** Seeds an empty, migrated database. Throws if areas already exist. */
export function seed(db: Db): void {
  const existing = db.select({ n: count() }).from(areas).get();
  if (existing && existing.n > 0) throw new Error("database already seeded");

  db.transaction((tx) => {
    const ids = new Map<string, number>();
    let seedNumber = 0;

    const insertArea = (
      area: SeedArea,
      parent: { id: number; path: string; region: Region } | null,
    ) => {
      const level =
        parent === null ? "district" : parent.path.includes("/") ? "parish" : "municipality";
      const slug = slugify(area.name);
      const path = parent ? `${parent.path}/${slug}` : slug;
      const region = area.region ?? parent?.region ?? "continente";
      const row = tx
        .insert(areas)
        .values({
          code: area.code ?? null,
          level,
          parentId: parent?.id ?? null,
          name: area.name,
          slug,
          path,
          region,
          lat: area.lat ?? null,
          lng: area.lng ?? null,
        })
        .returning({ id: areas.id })
        .get();
      ids.set(path, row.id);

      seedNumber++;
      for (const [metric, latest, growth, decimals] of [
        ["sale_eur_m2_median", area.sale, ANNUAL_GROWTH.sale, 0],
        ["rent_eur_m2_median", area.rent, ANNUAL_GROWTH.rent, 1],
      ] as const) {
        for (const point of syntheticSeries(latest, growth, seedNumber, decimals)) {
          tx.insert(marketStats)
            .values({ areaId: row.id, metric, source: "seed", synthetic: true, ...point })
            .run();
        }
      }

      for (const child of area.children ?? []) insertArea(child, { id: row.id, path, region });
    };
    for (const area of seedAreas) insertArea(area, null);

    const idOf = (path: string) => {
      const id = ids.get(path);
      if (id === undefined) throw new Error(`seed references unknown area "${path}"`);
      return id;
    };

    for (const [path, profile] of Object.entries(seedAlProfiles)) {
      for (let m = 0; m < 12; m++) {
        tx.insert(alIndicators)
          .values({
            areaId: idOf(path),
            year: 2025,
            month: m + 1,
            adr: Math.round(profile.peakAdr * SEASONALITY.adr[m]!),
            occupancy: Math.round(profile.peakOccupancy * SEASONALITY.occupancy[m]! * 100) / 100,
            source: "seed",
            synthetic: true,
          })
          .run();
      }
    }

    for (const [path, status] of Object.entries(seedAlRules)) {
      tx.insert(alRules)
        .values({
          areaId: idOf(path),
          status,
          validFrom: "2025-01-01",
          notes: "Placeholder seed rule — confirm against the municipal AL regulation.",
          verified: false,
        })
        .run();
    }

    for (const [path, rate] of Object.entries(seedImiRates)) {
      tx.insert(imiRates)
        .values({ areaId: idOf(path), year: 2025, rate, verified: false })
        .run();
    }

    tx.insert(sources).values({ name: "Manual entry", kind: "manual", permitted: true }).run();
  });

  const draft = createParameterSetDraft(
    db,
    parameters2025,
    "Seed: mainland 2025 values, not yet verified by a tax advisor.",
  );
  activateParameterSet(db, draft.id);
}
