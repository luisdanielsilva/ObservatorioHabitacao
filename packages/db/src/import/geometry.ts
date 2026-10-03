import proj4 from "proj4";
import type { GeoJSONPolygonal } from "../schema";

/** Polygon rings: [ring][point][x, y]. */
export type Polygon = number[][][];
export type MultiPolygon = Polygon[];

/**
 * Coordinate systems used by CAOP 2025. All are ETRS89/PTRA08-based, which agrees with
 * WGS 84 to well under a metre — far below the simplification tolerance used here.
 */
const PROJECTIONS: Record<number, string> = {
  3763: "+proj=tmerc +lat_0=39.66825833333333 +lon_0=-8.133108333333334 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  5014: "+proj=utm +zone=25 +ellps=GRS80 +units=m +no_defs",
  5015: "+proj=utm +zone=26 +ellps=GRS80 +units=m +no_defs",
  5016: "+proj=utm +zone=28 +ellps=GRS80 +units=m +no_defs",
};

/** Returns a function converting projected [x, y] in `srsId` to WGS 84 [lng, lat]. */
export function toWgs84(srsId: number): (point: number[]) => [number, number] {
  const definition = PROJECTIONS[srsId];
  if (!definition) throw new Error(`Unsupported CRS EPSG:${srsId}`);
  const converter = proj4(definition, "WGS84");
  return (point) => converter.forward([point[0]!, point[1]!]) as [number, number];
}

// ── GeoPackage binary geometry ─────────────────────────────────────────────

const ENVELOPE_BYTES = [0, 32, 48, 48, 64, 0, 0, 0];

/**
 * Parses a GeoPackage geometry blob (GP header + WKB) holding a Polygon or MultiPolygon.
 * Z/M values are dropped. Returns the SRS id and the polygons as [ring][point][x, y].
 */
export function parseGpkgGeometry(blob: Uint8Array): { srsId: number; polygons: MultiPolygon } {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  if (blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error("Not a GeoPackage geometry");
  const flags = blob[3]!;
  const headerLittleEndian = (flags & 1) === 1;
  const srsId = view.getInt32(4, headerLittleEndian);
  const envelope = ENVELOPE_BYTES[(flags >> 1) & 0b111]!;
  if ((flags >> 4) & 1) return { srsId, polygons: [] };

  let offset = 8 + envelope;
  const readGeometry = (): MultiPolygon => {
    const little = blob[offset] === 1;
    offset += 1;
    const rawType = view.getUint32(offset, little);
    offset += 4;
    // ISO WKB adds 1000/2000/3000 for Z/M/ZM; EWKB sets the high bits instead.
    const hasZ =
      (rawType & 0x80000000) !== 0 || [1, 3].includes(Math.floor((rawType & 0xffff) / 1000));
    const hasM =
      (rawType & 0x40000000) !== 0 || [2, 3].includes(Math.floor((rawType & 0xffff) / 1000));
    const type = (rawType & 0xffff) % 1000;
    const dims = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);

    const readPolygon = (): Polygon => {
      const rings = view.getUint32(offset, little);
      offset += 4;
      const polygon: Polygon = [];
      for (let r = 0; r < rings; r++) {
        const points = view.getUint32(offset, little);
        offset += 4;
        const ring: number[][] = [];
        for (let p = 0; p < points; p++) {
          ring.push([view.getFloat64(offset, little), view.getFloat64(offset + 8, little)]);
          offset += 8 * dims;
        }
        polygon.push(ring);
      }
      return polygon;
    };

    if (type === 3) return [readPolygon()];
    if (type === 6) {
      const count = view.getUint32(offset, little);
      offset += 4;
      const polygons: MultiPolygon = [];
      for (let i = 0; i < count; i++) polygons.push(...readGeometry());
      return polygons;
    }
    throw new Error(`Unsupported WKB geometry type ${rawType}`);
  };

  return { srsId, polygons: readGeometry() };
}

// ── Simplification ─────────────────────────────────────────────────────────

function perpendicularDistance(p: number[], a: number[], b: number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  if (dx === 0 && dy === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!);
  const t = ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0]! - (a[0]! + clamped * dx), p[1]! - (a[1]! + clamped * dy));
}

/** Douglas–Peucker simplification of a polyline (iterative, so large rings are safe). */
export function simplifyLine(points: number[][], tolerance: number): number[][] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i]!, points[start]!, points[end]!);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Absolute area of a ring (shoelace formula), in the ring's units squared. */
export function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j]![0]! + ring[i]![0]!) * (ring[j]![1]! - ring[i]![1]!);
  }
  return Math.abs(sum / 2);
}

/**
 * Simplifies polygons in projected (metre) coordinates. Rings that collapse below a valid
 * ring, or whose area is below `minArea` m², are dropped; the largest polygon is always kept.
 * Neighbouring boundaries are simplified independently, so small gaps or overlaps of up to
 * about `tolerance` metres can appear — acceptable for locating a property, not for cadastre.
 */
export function simplifyPolygons(
  polygons: MultiPolygon,
  tolerance: number,
  minArea = 0,
): MultiPolygon {
  let largest = 0;
  polygons.forEach((p, i) => {
    if (ringArea(p[0]!) > ringArea(polygons[largest]![0]!)) largest = i;
  });
  const valid = (ring: number[][]) => ring.length >= 4 && ringArea(ring) >= minArea;

  const result: MultiPolygon = [];
  polygons.forEach((polygon, i) => {
    let outer = simplifyLine(polygon[0]!, tolerance);
    if (!valid(outer)) {
      if (i !== largest) return;
      outer = polygon[0]!;
    }
    const holes = polygon
      .slice(1)
      .map((ring) => simplifyLine(ring, tolerance))
      .filter(valid);
    result.push([outer, ...holes]);
  });
  return result;
}

/** Area-weighted centroid of the largest polygon's outer ring. */
export function centroid(polygons: MultiPolygon): number[] {
  let best = polygons[0]![0]!;
  for (const p of polygons) if (ringArea(p[0]!) > ringArea(best)) best = p[0]!;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f = best[j]![0]! * best[i]![1]! - best[i]![0]! * best[j]![1]!;
    a += f;
    cx += (best[j]![0]! + best[i]![0]!) * f;
    cy += (best[j]![1]! + best[i]![1]!) * f;
  }
  if (a === 0) return best[0]!;
  return [cx / (3 * a), cy / (3 * a)];
}

/** Projects polygons to WGS 84, rounding to 5 decimals (about 1 m). */
export function projectPolygons(polygons: MultiPolygon, srsId: number): MultiPolygon {
  const convert = toWgs84(srsId);
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return polygons.map((polygon) =>
    polygon.map((ring) => ring.map((point) => convert(point).map(round))),
  );
}

export function toGeoJSON(polygons: MultiPolygon): GeoJSONPolygonal {
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0]! }
    : { type: "MultiPolygon", coordinates: polygons };
}

export function boundingBox(polygons: MultiPolygon) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const [lng, lat] of polygon[0]!) {
      minLng = Math.min(minLng, lng!);
      maxLng = Math.max(maxLng, lng!);
      minLat = Math.min(minLat, lat!);
      maxLat = Math.max(maxLat, lat!);
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}
