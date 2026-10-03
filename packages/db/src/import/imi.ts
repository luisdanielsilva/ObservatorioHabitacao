import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { areas, imiRates } from "../schema";
import { fetchWithRetry } from "./http";
import type { ImportCounts } from "./run";

/**
 * Municipal IMI rates for urban property (WBS 4.5.2).
 *
 * Source: "Taxas municipais de IMI dos 308 municípios portugueses" by HOLY CHAOS, Unipessoal
 * Lda (flatin.pt), CC BY 4.0, listed on dados.gov.pt and archived at
 * https://doi.org/10.5281/zenodo.22935147. It is a transcription of the Portal das Finanças
 * "Taxas de IMI" consultation, which has no machine-readable endpoint. Because it is a third
 * party transcription, rows are stored with verified = false.
 *
 * Year: the fiscal year the rate applies to (IMI of year N is billed in N+1). Municipalities
 * that set rates per parish have no single rate and are skipped.
 */
export const IMI_SOURCE_URL = "https://flatin.pt/api/v1/imi/rates-history.csv";
export const IMI_ATTRIBUTION =
  "Taxas de IMI: Autoridade Tributária, via flatin.pt (HOLY CHAOS, Unipessoal Lda), CC BY 4.0";

export interface ImiRow {
  /** DICO code as used by the tax authority, four digits. */
  code: string;
  /** Municipality name, used to match the islands (see `islandRegion`). */
  name: string;
  year: number;
  /** Urban rate as a fraction (0.3 % → 0.003). */
  rate: number;
}

/** Parses the CSV; rows without an urban rate (rates set per parish) are dropped. */
export function parseImiCsv(csv: string): ImiRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header!.split(",");
  const col = (name: string) => {
    const i = columns.indexOf(name);
    if (i < 0) throw new Error(`IMI CSV: missing column ${name}`);
    return i;
  };
  const [code, name, year, urban] = [
    col("codigo"),
    col("municipality"),
    col("year"),
    col("urban_rate_percent"),
  ];
  const rows: ImiRow[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    const percent = Number(cells[urban]?.replace("%", "").replace(",", "."));
    if (!cells[urban]?.trim() || !Number.isFinite(percent)) continue;
    // The legal range is 0.3 %–0.45 % (up to 0.5 % under financial recovery plans).
    if (percent <= 0 || percent > 1) throw new Error(`IMI CSV: implausible rate ${percent} %`);
    rows.push({
      code: cells[code]!.trim().padStart(4, "0"),
      name: cells[name]!.trim(),
      year: Number(cells[year]),
      rate: Math.round(percent * 1e5) / 1e7,
    });
  }
  return rows;
}

/**
 * The tax authority still codes island municipalities by the former districts (19 Angra do
 * Heroísmo, 20 Horta, 21 Ponta Delgada: Açores; 22 Funchal: Madeira), while CAOP uses island
 * codes (41–49 Açores, 31–32 Madeira). Those are matched by name within the region instead.
 */
export function islandRegion(code: string): "acores" | "madeira" | null {
  const district = code.slice(0, 2);
  if (district === "19" || district === "20" || district === "21") return "acores";
  if (district === "22") return "madeira";
  return null;
}

/** Island municipality names that differ between the tax authority and CAOP. */
const ISLAND_ALIASES: Record<string, string> = { "Calheta (Açores)": "Calheta de São Jorge" };

/** "Calheta (Madeira)" → "calheta". */
function normaliseName(name: string): string {
  return (ISLAND_ALIASES[name] ?? name)
    .replace(/\s*\((Açores|Madeira)\)$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Upserts rates for municipalities matched by DICO code (by name for the islands). Existing rows for the same
 * municipality and year (including placeholder seed rows) are replaced.
 */
export function storeImiRates(db: Db, rows: ImiRow[]): ImportCounts & { unmatched: string[] } {
  const municipalities = db
    .select({ id: areas.id, code: areas.code, name: areas.name, region: areas.region })
    .from(areas)
    .where(eq(areas.level, "municipality"))
    .all();
  const byCode = new Map(municipalities.map((m) => [m.code, m.id]));
  const byIslandName = new Map(
    municipalities
      .filter((m) => m.region !== "continente")
      .map((m) => [`${m.region}|${normaliseName(m.name)}`, m.id]),
  );
  const areaIdFor = (row: ImiRow) => {
    const region = islandRegion(row.code);
    return region ? byIslandName.get(`${region}|${normaliseName(row.name)}`) : byCode.get(row.code);
  };
  const counts = { seen: rows.length, new: 0, updated: 0, unmatched: [] as string[] };

  db.transaction((tx) => {
    for (const row of rows) {
      const areaId = areaIdFor(row);
      if (areaId === undefined) {
        counts.unmatched.push(row.code);
        continue;
      }
      const existing = tx
        .select({ id: imiRates.id })
        .from(imiRates)
        .where(and(eq(imiRates.areaId, areaId), eq(imiRates.year, row.year)))
        .get();
      if (existing) {
        tx.update(imiRates)
          .set({ rate: row.rate, verified: false })
          .where(eq(imiRates.id, existing.id))
          .run();
        counts.updated++;
      } else {
        tx.insert(imiRates)
          .values({ areaId, year: row.year, rate: row.rate, verified: false })
          .run();
        counts.new++;
      }
    }
  });
  return counts;
}

export async function importImi(db: Db): Promise<ImportCounts> {
  const csv = await (await fetchWithRetry(IMI_SOURCE_URL)).text();
  const rows = parseImiCsv(csv);
  if (rows.length < 300) throw new Error(`IMI CSV: only ${rows.length} rates, expected ~900`);
  const counts = storeImiRates(db, rows);
  if (counts.unmatched.length) {
    console.warn(`IMI: ${counts.unmatched.length} codes without a municipality`, counts.unmatched);
  }
  return { seen: counts.seen, new: counts.new, updated: counts.updated };
}
