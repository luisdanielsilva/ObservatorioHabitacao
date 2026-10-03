import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { areas } from "../schema";
import { fetchJson } from "./http";
import type { ImportCounts } from "./run";

/**
 * Active short-term rental (alojamento local) registrations per parish and municipality, from the
 * Registo Nacional de Alojamento Local (RNAL) published by Turismo de Portugal as open data:
 * https://dadosabertos.turismodeportugal.pt/datasets/turismoportugal::estabelecimentos-de-alojamento-local
 * The licence is not stated on the portal; confirm reuse terms before showing figures publicly.
 *
 * Counts are aggregated by the ArcGIS service (one request), not downloaded record by record.
 * The schema has no table for them yet, so they are written as JSON under data/raw/rnal/.
 */
export const RNAL_LAYER =
  "https://geo.turismodeportugal.pt/server/rest/services/TDP/OpenData_AL/MapServer/6/query";

export interface RnalGroup {
  /** CAOP parish code (DTMNFR). */
  parishCode: string;
  /** Moradia, Apartamento, EstabelecimentoHospedagem, Quartos, … */
  modality: string;
  establishments: number;
  /** Sum of NrUtentes (guest capacity). */
  guests: number;
}

export interface RnalCounts {
  establishments: number;
  guests: number;
  byModality: Record<string, number>;
}

export interface RnalSnapshot {
  source: string;
  retrievedAt: string;
  totals: RnalCounts;
  /** Keyed by CAOP code. */
  parishes: Record<string, RnalCounts & { areaId: number | null }>;
  municipalities: Record<string, RnalCounts & { areaId: number | null }>;
  unmatchedParishCodes: string[];
}

interface ArcGisStats {
  features?: {
    attributes: {
      DTMNFR: string | null;
      Modalidade: string | null;
      n: number;
      guests: number | null;
    };
  }[];
  exceededTransferLimit?: boolean;
  error?: { message: string };
}

export function rnalQueryUrl(): string {
  const params = new URLSearchParams({
    where: "1=1",
    outStatistics: JSON.stringify([
      { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" },
      { statisticType: "sum", onStatisticField: "NrUtentes", outStatisticFieldName: "guests" },
    ]),
    groupByFieldsForStatistics: "DTMNFR,Modalidade",
    f: "json",
  });
  return `${RNAL_LAYER}?${params}`;
}

export function parseRnalStats(body: ArcGisStats): RnalGroup[] {
  if (body.error) throw new Error(`RNAL: ${body.error.message}`);
  if (body.exceededTransferLimit) throw new Error("RNAL: result truncated by the server");
  return (body.features ?? [])
    .filter((f) => f.attributes.DTMNFR)
    .map(({ attributes: a }) => ({
      parishCode: a.DTMNFR!.trim(),
      modality: a.Modalidade ?? "Desconhecida",
      establishments: a.n,
      guests: a.guests ?? 0,
    }));
}

const empty = (): RnalCounts => ({ establishments: 0, guests: 0, byModality: {} });
function add(target: RnalCounts, g: RnalGroup) {
  target.establishments += g.establishments;
  target.guests += g.guests;
  target.byModality[g.modality] = (target.byModality[g.modality] ?? 0) + g.establishments;
}

/** Aggregates groups per parish and municipality (first four digits of the parish code). */
export function aggregateRnal(db: Db, groups: RnalGroup[], retrievedAt: string): RnalSnapshot {
  const ids = new Map(
    db
      .select({ id: areas.id, code: areas.code })
      .from(areas)
      .all()
      .filter((a) => a.code)
      .map((a) => [a.code!, a.id]),
  );
  const parishLevel = new Set(
    db
      .select({ code: areas.code })
      .from(areas)
      .where(eq(areas.level, "parish"))
      .all()
      .map((a) => a.code),
  );
  const snapshot: RnalSnapshot = {
    source:
      "https://dadosabertos.turismodeportugal.pt/datasets/turismoportugal::estabelecimentos-de-alojamento-local",
    retrievedAt,
    totals: empty(),
    parishes: {},
    municipalities: {},
    unmatchedParishCodes: [],
  };
  for (const g of groups) {
    add(snapshot.totals, g);
    const municipality = g.parishCode.slice(0, 4);
    snapshot.parishes[g.parishCode] ??= { ...empty(), areaId: ids.get(g.parishCode) ?? null };
    snapshot.municipalities[municipality] ??= { ...empty(), areaId: ids.get(municipality) ?? null };
    add(snapshot.parishes[g.parishCode]!, g);
    add(snapshot.municipalities[municipality]!, g);
    if (!parishLevel.has(g.parishCode) && !snapshot.unmatchedParishCodes.includes(g.parishCode)) {
      snapshot.unmatchedParishCodes.push(g.parishCode);
    }
  }
  return snapshot;
}

/** Fetches the counts and writes data/raw/rnal/al-counts-YYYY-MM-DD.json (and latest.json). */
export async function importRnal(db: Db, outDir: string): Promise<ImportCounts & { file: string }> {
  const groups = parseRnalStats(await fetchJson<ArcGisStats>(rnalQueryUrl()));
  const retrievedAt = new Date().toISOString();
  const snapshot = aggregateRnal(db, groups, retrievedAt);
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `al-counts-${retrievedAt.slice(0, 10)}.json`);
  const json = JSON.stringify(snapshot, null, 1);
  writeFileSync(file, json);
  writeFileSync(path.join(outDir, "latest.json"), json);
  return { seen: groups.length, new: Object.keys(snapshot.parishes).length, updated: 0, file };
}
