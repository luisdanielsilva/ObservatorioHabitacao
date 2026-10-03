/**
 * INE import: median sale and rent prices per m², by municipality and parish.
 *
 * API: https://www.ine.pt/ine/json_indicador/pindica.jsp (data) and pindicaMeta.jsp
 * (metadata). INE data may be reused with attribution ("Fonte: INE").
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import { areas, marketStats, type MarketMetric } from "../schema";
import { fetchJson, sleep } from "./http";
import type { ImportCounts } from "./run";

export interface IneIndicator {
  varcd: string;
  metric: MarketMetric;
  /** Exact INE title, kept for traceability. */
  definition: string;
  /** Fixed dimensions besides period (Dim1) and geography (Dim2). */
  fixedDims: Record<string, string>;
}

export const INE_INDICATORS: IneIndicator[] = [
  {
    varcd: "0012234",
    metric: "sale_eur_m2_median",
    definition:
      "Valor mediano das vendas de alojamentos familiares nos últimos 12 meses (Metodologia 2022 - €/m²) " +
      "por Localização geográfica (NUTS - 2024) e Categoria do alojamento familiar; Trimestral. " +
      "Rolling 12 months ending in the quarter; category H1 = Total (new and existing). " +
      "Parish detail only for the Porto and Lisbon metropolitan areas, Setúbal peninsula, Algarve " +
      "and municipalities above 100 000 inhabitants.",
    fixedDims: { Dim3: "H1" },
  },
  {
    varcd: "0014698",
    metric: "rent_eur_m2_median",
    definition:
      "Valor mediano das rendas de novos contratos de arrendamento de alojamentos familiares " +
      "(Metodologia 2026 - €/m²) por Localização geográfica (NUTS - 2024); Anual. " +
      "Replaces 0012600 (Metodologia 2021).",
    fixedDims: {},
  },
];

const BASE = "https://www.ine.pt/ine/json_indicador";

/**
 * INE period code → our period label: "S5A20261" → "2026-Q1" (quarter),
 * "S7A2025" → "2025" (year), "S3A202608" → "2026-08" (month).
 */
export function parseInePeriod(code: string): string | undefined {
  const quarter = code.match(/^S5A(\d{4})([1-4])$/);
  if (quarter) return `${quarter[1]}-Q${quarter[2]}`;
  const year = code.match(/^S7A(\d{4})$/);
  if (year) return year[1];
  const month = code.match(/^S3A(\d{4})(\d{2})$/);
  if (month) return `${month[1]}-${month[2]}`;
  return undefined;
}

/**
 * INE geography code → our area key. INE prefixes CAOP codes with the 3-character NUTS III
 * code: "1A01106" → municipality "1106", "1A0110656" → parish "110656". NUTS II "20" and "30"
 * are the Açores and Madeira regions. Other NUTS levels have no area here.
 */
export function mapIneGeography(
  geocod: string,
): { code: string } | { region: "acores" | "madeira" } | undefined {
  if (geocod === "20") return { region: "acores" };
  if (geocod === "30") return { region: "madeira" };
  if (geocod.length === 7) return { code: geocod.slice(3) };
  if (geocod.length === 9) return { code: geocod.slice(3) };
  return undefined;
}

interface IneDataResponse {
  Sucesso?: { Verdadeiro?: unknown; Falso?: { Msg: string }[] };
  Dados?: Record<string, { geocod: string; valor?: string }[]>;
}

export interface IneValue {
  geocod: string;
  value: number;
}

/** Values from one pindica.jsp response; rows without a value (confidential, n/a) are skipped. */
export function parseIneData(response: IneDataResponse | IneDataResponse[]): IneValue[] {
  const body = Array.isArray(response) ? response[0]! : response;
  if (!body.Dados) {
    throw new Error(`INE error: ${body.Sucesso?.Falso?.map((f) => f.Msg).join("; ") ?? "no data"}`);
  }
  const rows = Object.values(body.Dados).flat();
  return rows
    .filter((r) => r.valor !== undefined && r.valor !== "")
    .map((r) => ({ geocod: r.geocod, value: Number(r.valor) }))
    .filter((r) => Number.isFinite(r.value));
}

interface IneMetaResponse {
  Dimensoes: { Categoria_Dim: Record<string, { categ_cod: string }[]>[] };
}

/** Period codes available for an indicator, oldest first. */
export function parseInePeriods(response: IneMetaResponse | IneMetaResponse[]): string[] {
  const body = Array.isArray(response) ? response[0]! : response;
  const categories = body.Dimensoes.Categoria_Dim[0] ?? {};
  return Object.entries(categories)
    .filter(([key]) => key.startsWith("Dim_Num1_"))
    .map(([, value]) => value[0]!.categ_cod)
    .sort();
}

export interface IneImportOptions {
  /** Only fetch the most recent N periods (default: all). */
  lastPeriods?: number;
  /** Delay between requests, ms. */
  delayMs?: number;
}

/** Writes one indicator's values for one period; returns counts. */
export function storeIneValues(
  db: Db,
  metric: MarketMetric,
  period: string,
  values: IneValue[],
): ImportCounts & { areaIds: number[] } {
  const all = db.select({ id: areas.id, code: areas.code, path: areas.path }).from(areas).all();
  const byCode = new Map(all.filter((a) => a.code).map((a) => [a.code!, a.id]));
  const byPath = new Map(all.map((a) => [a.path, a.id]));
  const counts = { seen: values.length, new: 0, updated: 0, areaIds: [] as number[] };

  db.transaction((tx) => {
    for (const { geocod, value } of values) {
      const key = mapIneGeography(geocod);
      if (!key) continue;
      const areaId = "code" in key ? byCode.get(key.code) : byPath.get(key.region);
      if (areaId === undefined) continue;
      const existing = tx
        .select({ id: marketStats.id })
        .from(marketStats)
        .where(
          and(
            eq(marketStats.areaId, areaId),
            eq(marketStats.period, period),
            eq(marketStats.metric, metric),
            eq(marketStats.source, "ine"),
          ),
        )
        .get();
      if (existing) {
        tx.update(marketStats)
          .set({ value, synthetic: false })
          .where(eq(marketStats.id, existing.id))
          .run();
        counts.updated++;
      } else {
        tx.insert(marketStats)
          .values({ areaId, period, metric, value, source: "ine", synthetic: false })
          .run();
        counts.new++;
      }
      counts.areaIds.push(areaId);
    }
  });
  return counts;
}

/**
 * Removes synthetic rows that real INE data now replaces: those of areas with INE data for the
 * metric, and those of parishes whose municipality has INE data (the parish then falls back to
 * the municipality's real value instead of showing a placeholder). Districts are untouched:
 * INE publishes no district-level medians.
 */
export function removeReplacedSyntheticRows(db: Db, metric: MarketMetric): number {
  const withIne = new Set(
    db
      .selectDistinct({ areaId: marketStats.areaId })
      .from(marketStats)
      .where(and(eq(marketStats.metric, metric), eq(marketStats.source, "ine")))
      .all()
      .map((r) => r.areaId),
  );
  if (!withIne.size) return 0;
  const parishes = db
    .select({ id: areas.id, parentId: areas.parentId })
    .from(areas)
    .where(eq(areas.level, "parish"))
    .all();
  const replaced = [
    ...withIne,
    ...parishes.filter((p) => p.parentId !== null && withIne.has(p.parentId)).map((p) => p.id),
  ];
  let removed = 0;
  for (let i = 0; i < replaced.length; i += 500) {
    removed += db
      .delete(marketStats)
      .where(
        and(
          eq(marketStats.metric, metric),
          eq(marketStats.synthetic, true),
          inArray(marketStats.areaId, replaced.slice(i, i + 500)),
        ),
      )
      .run().changes;
  }
  return removed;
}

/** Minimum municipalities with data for a district figure to be derived. */
const MIN_MUNICIPALITIES = 3;

/**
 * INE publishes no district figures, so district values are derived: per period, the median of
 * the district's municipal medians (only when at least 3 municipalities have data). They are
 * stored with source "ine_derived" so pages can explain how they were calculated, and they
 * replace the district's synthetic seed rows.
 */
export function deriveDistrictMedians(db: Db, metric: MarketMetric): number {
  const municipalities = db
    .select({ id: areas.id, parentId: areas.parentId })
    .from(areas)
    .where(eq(areas.level, "municipality"))
    .all();
  const districtOf = new Map(municipalities.map((m) => [m.id, m.parentId]));
  const rows = db
    .select({ areaId: marketStats.areaId, period: marketStats.period, value: marketStats.value })
    .from(marketStats)
    .where(and(eq(marketStats.metric, metric), eq(marketStats.source, "ine")))
    .all();

  // Areas that INE covers directly (the Açores and Madeira regions) keep INE's own figure.
  const published = new Set(rows.map((r) => `${r.areaId}|${r.period}`));
  const groups = new Map<string, { districtId: number; period: string; values: number[] }>();
  for (const r of rows) {
    const districtId = districtOf.get(r.areaId);
    if (districtId === undefined || districtId === null) continue;
    const key = `${districtId}|${r.period}`;
    const group = groups.get(key) ?? { districtId, period: r.period, values: [] };
    group.values.push(r.value);
    groups.set(key, group);
  }

  let stored = 0;
  db.transaction((tx) => {
    for (const { districtId, period, values } of groups.values()) {
      const key = `${districtId}|${period}`;
      if (published.has(key)) {
        tx.delete(marketStats)
          .where(
            and(
              eq(marketStats.areaId, districtId),
              eq(marketStats.period, period),
              eq(marketStats.metric, metric),
              eq(marketStats.source, "ine_derived"),
            ),
          )
          .run();
        continue;
      }
      if (values.length < MIN_MUNICIPALITIES) continue;
      const value = median(values);
      tx.insert(marketStats)
        .values({
          areaId: districtId,
          period,
          metric,
          value: Math.round(value * 10) / 10,
          sampleSize: values.length,
          source: "ine_derived",
          synthetic: false,
        })
        .onConflictDoUpdate({
          target: [marketStats.areaId, marketStats.period, marketStats.metric, marketStats.source],
          set: { value: Math.round(value * 10) / 10, sampleSize: values.length },
        })
        .run();
      stored++;
    }
    const districts = [...new Set([...groups.values()].map((g) => g.districtId))];
    if (districts.length) {
      tx.delete(marketStats)
        .where(
          and(
            eq(marketStats.metric, metric),
            eq(marketStats.synthetic, true),
            inArray(marketStats.areaId, districts),
          ),
        )
        .run();
    }
  });
  return stored;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Fetches and stores all periods of every INE indicator. */
export async function importIne(db: Db, options: IneImportOptions = {}): Promise<ImportCounts> {
  const total: ImportCounts = { seen: 0, new: 0, updated: 0 };
  const delay = options.delayMs ?? 750;
  for (const indicator of INE_INDICATORS) {
    const meta = await fetchJson<IneMetaResponse[]>(
      `${BASE}/pindicaMeta.jsp?varcd=${indicator.varcd}&lang=PT`,
    );
    let periods = parseInePeriods(meta);
    if (options.lastPeriods) periods = periods.slice(-options.lastPeriods);

    for (const code of periods) {
      const period = parseInePeriod(code);
      if (!period) throw new Error(`INE ${indicator.varcd}: unknown period code ${code}`);
      await sleep(delay);
      const params = new URLSearchParams({
        op: "2",
        varcd: indicator.varcd,
        Dim1: code,
        ...indicator.fixedDims,
        lang: "PT",
      });
      const data = await fetchJson<IneDataResponse[]>(`${BASE}/pindica.jsp?${params}`);
      const counts = storeIneValues(db, indicator.metric, period, parseIneData(data));
      total.seen += counts.seen;
      total.new += counts.new;
      total.updated += counts.updated;
    }
    removeReplacedSyntheticRows(db, indicator.metric);
    deriveDistrictMedians(db, indicator.metric);
  }
  return total;
}
