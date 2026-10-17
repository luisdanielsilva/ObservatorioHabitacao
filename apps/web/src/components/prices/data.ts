import "server-only";
import {
  getAreaBreadcrumb,
  getAreaByPath,
  getChildAreas,
  getMarketReference,
  getMarketSeries,
  getTopLevelAreas,
  type Area,
  type Db,
  type MarketReferenceValue,
} from "@observatorio-habitacao/db";

export interface AreaPrices {
  sale: MarketReferenceValue | null;
  rent: MarketReferenceValue | null;
  /** Median annual rent ÷ median sale price, when both exist. */
  grossYield: number | null;
}

/** One row of a price table. Only the area's own figures, never a parent's. */
export interface AreaRow {
  id: number;
  name: string;
  path: string;
  sale: number | null;
  rent: number | null;
  grossYield: number | null;
  saleYoy: number | null;
  synthetic: boolean;
}

export interface SeriesPoint {
  period: string;
  value: number;
}

export function grossYield(sale: number | null | undefined, rent: number | null | undefined) {
  return sale && rent ? (rent * 12) / sale : null;
}

/** Latest sale and rent medians for an area, falling back to the nearest parent with data. */
export function getAreaPrices(db: Db, areaId: number): AreaPrices {
  const sale = getMarketReference(db, areaId, "sale_eur_m2_median") ?? null;
  const rent = getMarketReference(db, areaId, "rent_eur_m2_median") ?? null;
  return { sale, rent, grossYield: grossYield(sale?.value, rent?.value) };
}

export function getAreaRows(db: Db, areas: Area[]): AreaRow[] {
  return areas.map((area) => {
    const prices = getAreaPrices(db, area.id);
    const sale = prices.sale?.areaId === area.id ? prices.sale : null;
    const rent = prices.rent?.areaId === area.id ? prices.rent : null;
    return {
      id: area.id,
      name: area.name,
      path: area.path,
      sale: sale?.value ?? null,
      rent: rent?.value ?? null,
      grossYield: grossYield(sale?.value, rent?.value),
      saleYoy: sale?.yearOnYear ?? null,
      synthetic: Boolean(sale?.synthetic || rent?.synthetic),
    };
  });
}

export function getOverviewRows(db: Db): AreaRow[] {
  return getAreaRows(db, getTopLevelAreas(db));
}

export interface AreaPageData {
  area: Area;
  breadcrumb: { id: number; name: string; path: string }[];
  prices: AreaPrices;
  series: { sale: SeriesPoint[]; rent: SeriesPoint[] };
  children: AreaRow[];
  /** The area and its siblings under the same parent (top-level areas for a district). */
  neighbours: AreaRow[];
}

export function getAreaPageData(db: Db, path: string): AreaPageData | undefined {
  const area = getAreaByPath(db, path);
  if (!area) return undefined;
  const prices = getAreaPrices(db, area.id);
  const seriesFor = (
    ref: MarketReferenceValue | null,
    metric: Parameters<typeof getMarketSeries>[2],
  ) =>
    ref
      ? getMarketSeries(db, ref.areaId, metric).map(({ period, value }) => ({ period, value }))
      : [];

  const siblings = area.parentId === null ? getTopLevelAreas(db) : getChildAreas(db, area.parentId);
  return {
    area,
    breadcrumb: getAreaBreadcrumb(db, area.id),
    prices,
    series: {
      sale: seriesFor(prices.sale, "sale_eur_m2_median"),
      rent: seriesFor(prices.rent, "rent_eur_m2_median"),
    },
    children: getAreaRows(db, getChildAreas(db, area.id)),
    neighbours: getAreaRows(db, siblings),
  };
}
