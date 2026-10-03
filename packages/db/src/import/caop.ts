/**
 * CAOP import (Carta Administrativa Oficial de Portugal, DGT).
 *
 * Source: https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop — one
 * GeoPackage for the mainland (EPSG:3763), two for the Açores (EPSG:5014/5015) and one for
 * Madeira (EPSG:5016). Builds the full district → municipality → parish hierarchy with
 * official codes (DI, DICO, DICOFRE) and stores simplified WGS 84 boundaries.
 *
 * The Açores and Madeira are imported as the top-level regions "acores" and "madeira"
 * (CAOP's island "distritos" are merged into them), matching the rest of the app.
 */
import Database from "better-sqlite3";
import { eq, like } from "drizzle-orm";
import { unzipSync } from "fflate";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Region } from "@olhovivo/engine";
import type { Db } from "../client";
import { analyses, areaBoundaries, areas, listings, valuations, type AreaLevel } from "../schema";
import { slugify } from "../seed";
import {
  boundingBox,
  centroid,
  parseGpkgGeometry,
  projectPolygons,
  simplifyPolygons,
  toGeoJSON,
  toWgs84,
  type MultiPolygon,
} from "./geometry";
import { fetchWithRetry } from "./http";
import type { ImportCounts } from "./run";

export const CAOP_VERSION = "CAOP 2025";

const DOWNLOADS = [
  { zip: "CAOP_Continente_2025-gpkg.zip", region: "continente" as const },
  { zip: "CAOP_RAA_2025-gpkg.zip", region: "acores" as const },
  { zip: "CAOP_RAM_2025-gpkg.zip", region: "madeira" as const },
];
const BASE_URL = "https://geo2.dgterritorio.gov.pt/caop/";

/** Simplification tolerance (m) and minimum kept ring area (m²) per level. */
const SIMPLIFY: Record<AreaLevel, { tolerance: number; minArea: number }> = {
  parish: { tolerance: 15, minArea: 500 },
  municipality: { tolerance: 40, minArea: 5_000 },
  district: { tolerance: 120, minArea: 50_000 },
};

export const REGION_NAMES = { acores: "Açores", madeira: "Madeira" } as const;

export interface CaopFeature {
  level: AreaLevel;
  /** DI, DICO or DICOFRE; null for the Açores/Madeira regions. */
  code: string | null;
  name: string;
  /** Parent code, or the region key for island municipalities; null for top level. */
  parentKey: string | null;
  region: Region;
  srsId: number;
  polygons: MultiPolygon;
}

/** Downloads and extracts the CAOP GeoPackages into `rawDir` (skips what is already there). */
export async function downloadCaop(rawDir: string): Promise<{ path: string; region: Region }[]> {
  mkdirSync(rawDir, { recursive: true });
  const result: { path: string; region: Region }[] = [];
  for (const { zip, region } of DOWNLOADS) {
    const zipPath = join(rawDir, zip);
    if (!existsSync(zipPath)) {
      const response = await fetchWithRetry(BASE_URL + zip);
      writeFileSync(zipPath, new Uint8Array(await response.arrayBuffer()));
    }
    const archive = new Uint8Array(readFileSync(zipPath));
    const gpkgs = listZipNames(archive).filter((name) => name.endsWith(".gpkg"));
    const missing = gpkgs.filter((name) => !existsSync(join(rawDir, name)));
    if (missing.length) {
      const entries = unzipSync(archive, { filter: (file) => missing.includes(file.name) });
      for (const [name, data] of Object.entries(entries)) writeFileSync(join(rawDir, name), data);
    }
    for (const name of gpkgs) result.push({ path: join(rawDir, name), region });
  }
  return result;
}

/** File names in a ZIP archive, from its central directory. */
function listZipNames(zip: Uint8Array): string[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a ZIP file");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = view.getUint16(offset + 28, true);
    const extra = view.getUint16(offset + 30, true);
    const comment = view.getUint16(offset + 32, true);
    names.push(new TextDecoder().decode(zip.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extra + comment;
  }
  return names;
}

/** Reads districts (or islands), municipalities and parishes from one CAOP GeoPackage. */
export function readCaopGeoPackage(path: string, region: Region): CaopFeature[] {
  const gpkg = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const layer = (suffix: string) => {
      const row = gpkg
        .prepare(
          "SELECT table_name AS name FROM gpkg_contents WHERE data_type = 'features' AND table_name LIKE ? ESCAPE '\\'",
        )
        .get(`%\\_${suffix}`) as { name: string } | undefined;
      if (!row) throw new Error(`${path}: no "${suffix}" layer`);
      return row.name;
    };
    const rows = <T>(sql: string) => gpkg.prepare(sql).all() as (T & { geom: Uint8Array })[];
    const features: CaopFeature[] = [];
    const add = (
      level: AreaLevel,
      code: string | null,
      name: string,
      parentKey: string | null,
      geom: Uint8Array,
    ) => {
      const { srsId, polygons } = parseGpkgGeometry(geom);
      features.push({ level, code, name, parentKey, region, srsId, polygons });
    };

    if (region === "continente") {
      for (const d of rows<{ dt: string; distrito: string }>(
        `SELECT dt, distrito, geom FROM "${layer("distritos")}"`,
      )) {
        add("district", d.dt, d.distrito, null, d.geom);
      }
    } else {
      // Islands are merged into the region by the caller.
      for (const d of rows<{ dt: string; distrito: string }>(
        `SELECT dt, distrito, geom FROM "${layer("distritos")}"`,
      )) {
        add("district", null, REGION_NAMES[region], null, d.geom);
      }
    }
    for (const m of rows<{ dtmn: string; municipio: string }>(
      `SELECT dtmn, municipio, geom FROM "${layer("municipios")}"`,
    )) {
      add(
        "municipality",
        m.dtmn,
        m.municipio,
        region === "continente" ? m.dtmn.slice(0, 2) : region,
        m.geom,
      );
    }
    for (const p of rows<{ dtmnfr: string; designacao_simplificada: string; freguesia: string }>(
      `SELECT dtmnfr, freguesia, designacao_simplificada, geom FROM "${layer("freguesias")}"`,
    )) {
      add(
        "parish",
        p.dtmnfr,
        p.designacao_simplificada || p.freguesia,
        p.dtmnfr.slice(0, 4),
        p.geom,
      );
    }
    return features;
  } finally {
    gpkg.close();
  }
}

/** Merges the island features of a region into a single top-level feature. */
export function mergeRegionIslands(features: CaopFeature[]): CaopFeature[] {
  const merged = new Map<Region, CaopFeature>();
  const others: CaopFeature[] = [];
  for (const f of features) {
    if (f.level === "district" && f.code === null) {
      const existing = merged.get(f.region);
      if (existing) existing.polygons.push(...f.polygons);
      else merged.set(f.region, { ...f, polygons: [...f.polygons] });
    } else {
      others.push(f);
    }
  }
  return [...merged.values(), ...others];
}

// ── Name matching (reconciling seed parishes that have no code) ─────────────

/** Normalises a parish name for matching: no accents, case, "União das freguesias de", punctuation. */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^uniao das freguesias de\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Name variants: CAOP writes some parishes as "Braga (São Vicente)". */
function nameVariants(name: string, municipality: string): string[] {
  const variants = [normaliseName(name)];
  const wrapped = name.match(/^(.+?)\s*\((.+)\)$/);
  if (wrapped && normaliseName(wrapped[1]!) === normaliseName(municipality)) {
    variants.push(normaliseName(wrapped[2]!));
  }
  return variants;
}

export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/**
 * Finds the CAOP parish matching a seed parish name in the same municipality: exact match on
 * any name variant, else a unique candidate within edit distance 2 ("São Victor" → "São Vítor").
 */
export function matchParishName(
  seedName: string,
  candidates: { code: string; name: string }[],
  municipality: string,
): string | undefined {
  const target = normaliseName(seedName);
  const exact = candidates.filter((c) => nameVariants(c.name, municipality).includes(target));
  if (exact.length === 1) return exact[0]!.code;
  const close = candidates.filter((c) =>
    nameVariants(c.name, municipality).some((v) => levenshtein(v, target) <= 2),
  );
  return close.length === 1 ? close[0]!.code : undefined;
}

// ── Database upsert ─────────────────────────────────────────────────────────

interface Resolved extends CaopFeature {
  slug: string;
  path: string;
  parentId: number | null;
  id?: number;
}

/**
 * Upserts the CAOP hierarchy and boundaries. Areas are matched by code (and seed parishes
 * without a code by name), so existing ids stay stable. Seed parishes that do not exist in
 * CAOP are removed unless something references them.
 */
export function importCaopFeatures(db: Db, input: CaopFeature[]): ImportCounts {
  const features = mergeRegionIslands(input);
  const counts: ImportCounts = { seen: features.length, new: 0, updated: 0 };

  db.transaction((tx) => {
    const existing = tx.select().from(areas).all();
    const byCode = new Map(existing.filter((a) => a.code).map((a) => [a.code!, a]));
    const byPath = new Map(existing.map((a) => [a.path, a]));
    const claimed = new Set<number>();

    const sortOrder = { district: 0, municipality: 1, parish: 2 } as const;
    features.sort((a, b) => sortOrder[a.level] - sortOrder[b.level]);

    // Key → resolved feature, for parents. Top-level keys: district code or region key.
    const resolved = new Map<string, Resolved>();
    const siblings = new Map<string, Set<string>>();
    const uniqueSlug = (parentPath: string, name: string, code: string | null) => {
      const used = siblings.get(parentPath) ?? new Set<string>();
      siblings.set(parentPath, used);
      let slug = slugify(name);
      if (used.has(slug)) slug = `${slug}-${code ?? used.size}`;
      used.add(slug);
      return slug;
    };

    const seedParishes = existing.filter((a) => a.level === "parish" && !a.code);
    const caopParishesByMunicipality = new Map<string, { code: string; name: string }[]>();
    for (const f of features) {
      if (f.level !== "parish") continue;
      const list = caopParishesByMunicipality.get(f.parentKey!) ?? [];
      list.push({ code: f.code!, name: f.name });
      caopParishesByMunicipality.set(f.parentKey!, list);
    }

    for (const f of features) {
      const key = f.code ?? f.region;
      const parent = f.parentKey ? resolved.get(f.parentKey) : undefined;
      if (f.parentKey && !parent)
        throw new Error(`CAOP: parent ${f.parentKey} of ${key} not found`);
      const slug = uniqueSlug(parent?.path ?? "", f.name, f.code);
      const path = parent ? `${parent.path}/${slug}` : slug;

      let match = f.code ? byCode.get(f.code) : byPath.get(f.region);
      if (!match && f.level === "parish" && parent?.id !== undefined) {
        const candidates = seedParishes.filter(
          (s) => s.parentId === parent.id && !claimed.has(s.id),
        );
        for (const seedArea of candidates) {
          const code = matchParishName(
            seedArea.name,
            caopParishesByMunicipality.get(f.parentKey!) ?? [],
            parent.name,
          );
          if (code === f.code) {
            match = seedArea;
            break;
          }
        }
      }
      if (match) claimed.add(match.id);
      resolved.set(key, { ...f, slug, path, parentId: parent?.id ?? null, id: match?.id });
    }

    // Seed parishes CAOP does not know: drop them unless referenced.
    for (const seedArea of seedParishes) {
      if (claimed.has(seedArea.id)) continue;
      const referenced =
        tx
          .select({ id: analyses.id })
          .from(analyses)
          .where(eq(analyses.areaId, seedArea.id))
          .get() ??
        tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.areaId, seedArea.id))
          .get() ??
        tx
          .select({ id: valuations.id })
          .from(valuations)
          .where(eq(valuations.areaId, seedArea.id))
          .get();
      if (!referenced) tx.delete(areas).where(eq(areas.id, seedArea.id)).run();
    }

    // Move every matched area to a temporary path first, so renames never collide.
    for (const r of resolved.values()) {
      if (r.id !== undefined)
        tx.update(areas)
          .set({ path: `~${r.id}` })
          .where(eq(areas.id, r.id))
          .run();
    }

    for (const r of resolved.values()) {
      if (r.parentId === null && r.parentKey) {
        r.parentId = resolved.get(r.parentKey)!.id!;
      }
      const tolerance = SIMPLIFY[r.level];
      const simplified = simplifyPolygons(r.polygons, tolerance.tolerance, tolerance.minArea);
      const [cx, cy] = centroid(r.polygons);
      const [lng, lat] = toWgs84(r.srsId)([cx!, cy!]);
      const values = {
        code: r.code,
        level: r.level,
        parentId: r.parentId,
        name: r.name,
        slug: r.slug,
        path: r.path,
        region: r.region,
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
      };
      if (r.id !== undefined) {
        tx.update(areas).set(values).where(eq(areas.id, r.id)).run();
        counts.updated++;
      } else {
        r.id = tx.insert(areas).values(values).returning({ id: areas.id }).get().id;
        counts.new++;
      }

      const projected = projectPolygons(simplified, r.srsId);
      const boundary = {
        areaId: r.id,
        geometry: toGeoJSON(projected),
        ...boundingBox(projected),
        source: CAOP_VERSION,
      };
      tx.insert(areaBoundaries)
        .values(boundary)
        .onConflictDoUpdate({ target: areaBoundaries.areaId, set: boundary })
        .run();
    }

    const stranded = tx.select({ id: areas.id }).from(areas).where(like(areas.path, "~%")).get();
    if (stranded) throw new Error(`CAOP: area ${stranded.id} was left with a temporary path`);
  });

  return counts;
}
