/**
 * Euribor import: monthly averages from the ECB Data Portal (dataset FM, series
 * FM.M.U2.EUR.RT.MM.EURIBOR{3MD_,6MD_,1YD_}.HSTA — "historical close, average of
 * observations through period"). Values are stored as fractions (2.9 % → 0.029).
 */
import type { Db } from "../client";
import { upsertReferenceRate } from "../store";
import { fetchJson, sleep } from "./http";
import type { ImportCounts } from "./run";

export const EURIBOR_SERIES = [
  { name: "euribor_3m", key: "EURIBOR3MD_" },
  { name: "euribor_6m", key: "EURIBOR6MD_" },
  { name: "euribor_12m", key: "EURIBOR1YD_" },
] as const;

interface EcbResponse {
  dataSets: {
    series: Record<string, { observations: Record<string, [number | null, ...unknown[]]> }>;
  }[];
  structure: { dimensions: { observation: { values: { id: string }[] }[] } };
}

/** Monthly observations from an ECB jsondata response: "2026-09" → { date: "2026-09-01", value }. */
export function parseEcbSeries(response: EcbResponse): { date: string; value: number }[] {
  const series = Object.values(response.dataSets[0]?.series ?? {})[0];
  if (!series) throw new Error("ECB response has no series");
  const periods = response.structure.dimensions.observation[0]!.values;
  return Object.entries(series.observations)
    .filter(([, obs]) => typeof obs[0] === "number")
    .map(([index, obs]) => ({
      date: `${periods[Number(index)]!.id}-01`,
      value: Math.round((obs[0] as number) * 1e5) / 1e7,
    }));
}

export async function importEuribor(db: Db, months = 120): Promise<ImportCounts> {
  const counts: ImportCounts = { seen: 0, new: 0, updated: 0 };
  for (const { name, key } of EURIBOR_SERIES) {
    const url =
      `https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.${key}.HSTA` +
      `?format=jsondata&lastNObservations=${months}`;
    const observations = parseEcbSeries(await fetchJson<EcbResponse>(url));
    for (const o of observations) upsertReferenceRate(db, { name, source: "ecb", ...o });
    counts.seen += observations.length;
    counts.updated += observations.length;
    await sleep(500);
  }
  return counts;
}
