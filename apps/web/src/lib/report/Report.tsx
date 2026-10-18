import { chosenOutcomes } from "@/lib/calculator/run";
import type {
  GainTax,
  OpportunitySignal,
  ScenarioKind,
  ScenarioResult,
} from "@observatorio-habitacao/engine";
import {
  Circle,
  Document,
  Font,
  G,
  Image,
  Line,
  Link,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  compareListings,
  siteName,
  webUrl,
  type ComparableRow,
  type ComparablesSummary,
} from "@/lib/calculator/comparables";
import { COST_ITEMS, ownershipCosts, type CostItem } from "@/lib/calculator/costs";
import type { GainTaxText } from "@/lib/calculator/gainTax";
import type { SaleAnalysis, SaleStep } from "@/lib/calculator/sale";
import type { Condition, PropertyType } from "@/lib/calculator/state";
import type { Formatter } from "@/lib/format";
import { googleMapsUrl } from "@/lib/mapsLink";
import {
  BREAKDOWN_ROWS,
  cashBreakdown,
  stepLabels,
  type BreakdownRow,
  type WaterfallBar,
  waterfallBars,
} from "./breakdown";
import type { ReportData } from "./data";
import { labelLines, pdfSafe } from "./text";

/**
 * The scenario report (WBS 6.3.3), rendered server-side with React-PDF. All text is passed in
 * already translated; this component only lays it out.
 */
export interface ReportLabels {
  title: string;
  generated: string;
  property: string;
  location: string;
  marketReference: string;
  medianSale: string;
  medianRent: string;
  marketValues: string;
  purchase: string;
  results: string;
  missing: string;
  warnings: string;
  parameters: string;
  disclaimer: string;
  page: (page: number, total: number) => string;
  scenario: (kind: ScenarioKind) => string;
  /** The deal's full name, as a section title. */
  scenarioName: (kind: ScenarioKind) => string;
  metric: { key: MetricKey; label: string }[];
  metricHeader: string;
  acquisition: { label: string; items: [keyof AcquisitionItems, string][]; total: string };
  annualCosts: {
    label: string;
    items: Record<CostItem, string>;
    total: string;
    /** "12 meses" under a resale's column: its costs cover the months until the sale. */
    months: (months: number) => string;
    holdingNote: string;
  };
  sale: {
    title: string;
    breakEven: (kind: ScenarioKind) => string;
    noBreakEven: string;
    atExpected: (price: number) => string;
    help: (kind: ScenarioKind, years: number) => string;
    caption: (from: "breakEven" | "expected") => string;
    priceLabel: (kind: ScenarioKind) => string;
  };
  breakdown: {
    /** Short names under the waterfall's bars. */
    short: Record<BreakdownRow | "total" | "steps", string>;
    waterfall: string;
    /** The waterfall's title when the sale is at the steps' base price. */
    waterfallAt: (from: "breakEven" | "expected", price: string) => string;
    title: string;
    help: string;
    period: string;
    months: (months: number) => string;
    rows: Record<BreakdownRow, string>;
    total: string;
    kept: string;
  };
  gainTax: {
    title: string;
    describe: (g: GainTax) => GainTaxText;
    /** The note under the waterfall that explains its tax bar; null without one. */
    chartNote: (g: GainTax) => string | null;
  };
  comparables: {
    title: string;
    columns: Record<
      | "property"
      | "area"
      | "location"
      | "distance"
      | "askingPrice"
      | "perM2"
      | "vsThis"
      | "listing",
      string
    >;
    thisProperty: string;
    similar: (n: number) => string;
    /** "Apartamento T2". */
    type: (type: PropertyType, bedrooms: number | null) => string;
    condition: (condition: Condition | null) => string;
    verdict: (signal: OpportunitySignal) => string;
    verdictText: (diff: string, count: number, dearer: number) => string;
    tooFew: (count: number) => string;
    medianPerM2: string;
    range: string;
    medianPrice: string;
    valueAtMedian: string;
    km: (value: string) => string;
    openMap: string;
    vsThisHelp: string;
    differentNote: string;
    note: string;
  };
  warning: (code: string) => string;
  years: (n: number) => string;
  rows: { property: Row[]; market: Row[]; purchase: Row[] };
}

type AcquisitionItems = NonNullable<ScenarioResult["acquisition"]>;

/** One deal's sale-price analysis (lib/calculator/sale), as on the results page. */
export interface ReportSale {
  kind: ScenarioKind;
  analysis: SaleAnalysis;
  expectedProfit: number | null;
  /** The sale price the steps start from, and the deal's result with the sale at it. */
  basePrice: number | null;
  baseResult: ScenarioResult | null;
}

/** A property photo, already in a format the PDF can embed. */
export interface ReportPhoto {
  data: Buffer;
  width: number;
  height: number;
}

export type MetricKey =
  | "netProfit"
  | "irr"
  | "roi"
  | "monthlyCashFlow"
  | "annualCashFlow"
  | "lifetimeCashFlow"
  | "cashOnCash"
  | "grossYield"
  | "netYield"
  | "paybackYears"
  | "returnOnDeposit"
  | "totalInvestment"
  | "ownCapital"
  | "peakCapital";

export const REPORT_METRICS: { key: MetricKey; format: "euro" | "percent" | "years" }[] = [
  { key: "netProfit", format: "euro" },
  { key: "irr", format: "percent" },
  { key: "roi", format: "percent" },
  { key: "monthlyCashFlow", format: "euro" },
  { key: "annualCashFlow", format: "euro" },
  { key: "lifetimeCashFlow", format: "euro" },
  { key: "cashOnCash", format: "percent" },
  { key: "grossYield", format: "percent" },
  { key: "netYield", format: "percent" },
  { key: "paybackYears", format: "years" },
  { key: "returnOnDeposit", format: "percent" },
  { key: "totalInvestment", format: "euro" },
  { key: "ownCapital", format: "euro" },
  { key: "peakCapital", format: "euro" },
];

// Lines break between words only: no "reg-isto" or "Arrenda-mento".
Font.registerHyphenationCallback((word) => [word]);

/** Colours and styles shared with the seller's report (ValuationReport). */
export const C = {
  text: "#17211d",
  muted: "#5a6760",
  line: "#e2dacb",
  brand: "#1e5b45",
  brandAccent: "#c9a46a",
  bad: "#b91c1c",
  good: "#15803d",
};

/** The logo ("Ocular": a house in a telescope's eyepiece) and the name, for the PDF header. */
export function PdfBrand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Svg width={18} height={18} viewBox="0 0 32 32">
        <Circle cx={16} cy={16} r={11} stroke={C.brand} strokeWidth={2.4} fill="none" />
        <Path
          d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5"
          stroke={C.brandAccent}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
        <Path
          d="M10.5 18 16 13l5.5 5M12 17v5.5h8V17"
          stroke={C.brand}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text style={s.brand}>
        Observatório <Text style={s.brandAccent}>Habitação</Text>
      </Text>
    </View>
  );
}

/** The waterfall bars' labels, in pt. */
const WF_LABEL_SIZE = 6.5;

export const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: C.text, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
    paddingBottom: 8,
  },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandAccent: { color: C.brand },
  muted: { color: C.muted },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 5,
    color: C.brand,
  },
  twoCols: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  // Long values (a listing link, seasonal rates) wrap under their own column.
  kvLabel: { maxWidth: "50%", paddingRight: 8 },
  kvValue: { flex: 1, textAlign: "right" },
  link: { color: C.brand, textDecoration: "underline" },
  table: { borderTopWidth: 0.5, borderTopColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  bold: { fontFamily: "Helvetica-Bold", color: C.text },
  // Table cells line up with the label/value lists: flush left and right, same row height.
  th: { fontFamily: "Helvetica-Bold", paddingVertical: 3, paddingHorizontal: 3 },
  td: { paddingVertical: 3, paddingHorizontal: 3 },
  metricCell: { width: "28%", paddingLeft: 0 },
  valueCell: { width: "18%", textAlign: "right", paddingRight: 0 },
  label: { color: C.muted },
  negative: { color: C.bad },
  note: { fontSize: 8, color: C.muted, marginTop: 3 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: C.muted,
  },
  h3: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  deal: { marginBottom: 18, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.line },
  alert: { fontSize: 7.5, color: C.muted, marginBottom: 1.5 },
  costLabel: { width: "28%", paddingLeft: 0 },
  costHeader: { fontSize: 8 },
  saleFigure: { flex: 1, padding: 6, borderWidth: 0.5, borderColor: C.line },
  saleValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  good: { color: C.good },
  waterfall: { marginTop: 8 },
  wfValue: { fontSize: 7 },
  wfLabel: { fontSize: WF_LABEL_SIZE },
  wfStep: { fontSize: 6.5 },
  cmpHead: { fontSize: 7.5 },
  cmpCell: { fontSize: 7.5 },
  cmpVerdict: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  photos: { marginTop: 10 },
  mainPhoto: { width: "100%", height: 230, objectFit: "cover" },
  thumbs: { flexDirection: "row", gap: 6, marginTop: 6 },
  thumb: { width: 100, height: 70, objectFit: "cover" },
  disclaimer: {
    marginTop: 14,
    padding: 8,
    borderWidth: 0.5,
    borderColor: C.line,
    fontSize: 8,
    color: C.muted,
  },
});

/** A label and its value; a link makes the value open it, a total is in bold like in tables. */
export type Row = [label: string, value: string, options?: { href?: string; total?: boolean }];

export function KeyValues({ rows }: { rows: Row[] }) {
  return (
    <View>
      {rows.map(([k, v, options]) => (
        <View key={k} style={s.kv}>
          <Text style={options?.total ? [s.bold, s.kvLabel] : [s.muted, s.kvLabel]}>
            {pdfSafe(k)}
          </Text>
          {options?.href ? (
            <Link src={options.href} style={[s.kvValue, s.link]}>
              {pdfSafe(v)}
            </Link>
          ) : (
            <Text style={options?.total ? [s.kvValue, s.bold] : s.kvValue}>{pdfSafe(v)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function ScenarioReport({
  data,
  labels,
  f,
  sales = [],
  photos = [],
}: {
  data: ReportData;
  labels: ReportLabels;
  f: Formatter;
  sales?: ReportSale[];
  photos?: ReportPhoto[];
}) {
  // The deals the user chose, and only the indicators that apply to them.
  const outcomes = chosenOutcomes(data.output, data.state.deals);
  const output = { ...data.output, outcomes };
  const metrics = REPORT_METRICS.filter(({ key }) =>
    outcomes.some((o) => o.result && o.result[key] !== null),
  );
  const format = (v: number | null, kind: "euro" | "percent" | "years") =>
    v === null || !Number.isFinite(v)
      ? "—"
      : kind === "euro"
        ? f.euro(v)
        : kind === "percent"
          ? f.percent(v)
          : labels.years(Math.round(v * 10) / 10);
  const withResults = output.outcomes.filter((o) => o.result);
  // Smaller photos when similar listings share the first page with them.
  const compact = data.state.comparables.length > 0;
  const acquisition = withResults.find((o) => o.result?.acquisition)?.result?.acquisition;
  const annual = withResults.flatMap((o) => {
    const costs = ownershipCosts(o.kind, o.result!);
    return costs ? [{ kind: o.kind, costs }] : [];
  });

  return (
    <Document
      title={pdfSafe(`${labels.title} - ${data.name}`)}
      author="Observatório Habitação"
      creator="Observatório Habitação"
    >
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <PdfBrand />
          <Text style={s.muted}>{pdfSafe(labels.generated)}</Text>
        </View>

        <Text style={s.h1}>{pdfSafe(data.name)}</Text>
        <Text style={s.muted}>{pdfSafe(labels.title)}</Text>

        {photos.length > 0 && (
          <View style={s.photos} wrap={false}>
            {/* The main photo, then up to five more, smaller. Alt text does not apply here. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              src={{ data: photos[0]!.data, format: "jpg" }}
              style={[s.mainPhoto, compact ? { height: 150 } : {}]}
            />
            {photos.length > 1 && (
              <View style={s.thumbs}>
                {photos.slice(1, 6).map((p, i) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image
                    key={i}
                    src={{ data: p.data, format: "jpg" }}
                    style={[s.thumb, compact ? { height: 55 } : {}]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={s.twoCols}>
          <View style={s.col}>
            <Text style={s.h2}>{pdfSafe(labels.property)}</Text>
            <KeyValues rows={labels.rows.property} />
          </View>
          <View style={s.col}>
            <Text style={s.h2}>{pdfSafe(labels.marketValues)}</Text>
            <KeyValues rows={labels.rows.market} />
          </View>
        </View>

        {(data.reference.sale || data.reference.rent) && (
          <View>
            <Text style={s.h2}>{pdfSafe(labels.marketReference)}</Text>
            <KeyValues
              rows={[
                ...(data.reference.sale
                  ? [
                      [
                        labels.medianSale,
                        `${f.euroPerM2(data.reference.sale.value)} · ${data.reference.sale.areaName} · ${data.reference.sale.period}`,
                      ] as [string, string],
                    ]
                  : []),
                ...(data.reference.rent
                  ? [
                      [
                        labels.medianRent,
                        `${f.euroPerM2(data.reference.rent.value)} · ${data.reference.rent.areaName} · ${data.reference.rent.period}`,
                      ] as [string, string],
                    ]
                  : []),
              ]}
            />
          </View>
        )}

        {data.state.comparables.length > 0 && (
          <Comparables summary={compareListings(data.state)} data={data} labels={labels} f={f} />
        )}

        {/* Page 2: the purchase and its financing, then the money over the period held. */}
        <View wrap={false} break>
          <Text style={[s.h2, { marginTop: 0 }]}>{pdfSafe(labels.purchase)}</Text>
          <KeyValues rows={labels.rows.purchase} />
        </View>

        {/* The summary. The heading stays with its table. */}
        <View wrap={false}>
          <Text style={s.h2}>{pdfSafe(labels.results)}</Text>
          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, s.metricCell]}>{pdfSafe(labels.metricHeader)}</Text>
              {output.outcomes.map((o) => (
                <Text key={o.kind} style={[s.th, s.valueCell]}>
                  {pdfSafe(labels.scenario(o.kind))}
                </Text>
              ))}
            </View>
            {output.outcomes.some((o) => o.missing) && (
              <View style={s.tr}>
                <Text style={[s.td, s.metricCell, s.muted]}> </Text>
                {output.outcomes.map((o) => (
                  <Text key={o.kind} style={[s.td, s.valueCell, s.muted]}>
                    {o.missing ? pdfSafe(labels.missing) : " "}
                  </Text>
                ))}
              </View>
            )}
            {metrics.map(({ key, format: kind }) => (
              <View key={key} style={s.tr}>
                <Text style={[s.td, s.metricCell, s.label]}>
                  {pdfSafe(labels.metric.find((m) => m.key === key)?.label ?? key)}
                </Text>
                {output.outcomes.map((o) => {
                  const v = o.result ? o.result[key] : null;
                  return (
                    <Text
                      key={o.kind}
                      style={[s.td, s.valueCell, v !== null && v < 0 ? s.negative : {}]}
                    >
                      {o.result ? pdfSafe(format(v, kind)) : ""}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={s.twoCols} wrap={false}>
          <View style={s.col}>
            {acquisition && (
              <View>
                <Text style={s.h2}>{pdfSafe(labels.acquisition.label)}</Text>
                <KeyValues
                  rows={[
                    ...labels.acquisition.items
                      .filter(([k]) => acquisition[k] > 0)
                      .map(([k, label]) => [label, f.euro(acquisition[k])] as [string, string]),
                    [labels.acquisition.total, f.euro(acquisition.total), { total: true }],
                  ]}
                />
              </View>
            )}
          </View>
          <View style={s.col}>
            {annual.length > 0 && (
              <View>
                <Text style={s.h2}>{pdfSafe(labels.annualCosts.label)}</Text>
                <View style={s.table}>
                  <View style={s.tr}>
                    <Text style={[s.th, s.costLabel]}> </Text>
                    {annual.map(({ kind, costs }) => (
                      <Text
                        key={kind}
                        // Smaller, so "Arrendamento" fits a half-width column without breaking.
                        style={[
                          s.th,
                          s.valueCell,
                          s.costHeader,
                          { width: `${72 / annual.length}%` },
                        ]}
                      >
                        {pdfSafe(labels.scenario(kind))}
                        {costs.months !== null && (
                          <Text style={s.muted}>
                            {pdfSafe(`\n${labels.annualCosts.months(costs.months)}`)}
                          </Text>
                        )}
                      </Text>
                    ))}
                  </View>
                  {COST_ITEMS.filter((k) =>
                    annual.some(({ costs }) => costs.items[k] !== undefined),
                  ).map((k) => (
                    <View key={k} style={s.tr}>
                      <Text style={[s.td, s.costLabel, s.label]}>
                        {pdfSafe(labels.annualCosts.items[k])}
                      </Text>
                      {annual.map(({ kind, costs }) => (
                        <Text
                          key={kind}
                          style={[s.td, s.valueCell, { width: `${72 / annual.length}%` }]}
                        >
                          {pdfSafe(costs.items[k] === undefined ? "-" : f.euro(costs.items[k]!))}
                        </Text>
                      ))}
                    </View>
                  ))}
                  <View style={s.tr}>
                    <Text style={[s.th, s.costLabel]}>{pdfSafe(labels.annualCosts.total)}</Text>
                    {annual.map(({ kind, costs }) => (
                      <Text
                        key={kind}
                        style={[s.th, s.valueCell, { width: `${72 / annual.length}%` }]}
                      >
                        {pdfSafe(f.euro(costs.total))}
                      </Text>
                    ))}
                  </View>
                </View>
                {annual.some(({ costs }) => costs.months !== null) && (
                  <Text style={s.note}>{pdfSafe(labels.annualCosts.holdingNote)}</Text>
                )}
              </View>
            )}
          </View>
        </View>

        <Breakdown outcomes={withResults} labels={labels} f={f} />

        <Text style={s.note}>{pdfSafe(labels.parameters)}</Text>
        <View style={s.disclaimer} wrap={false}>
          <Text>{pdfSafe(labels.disclaimer)}</Text>
        </View>

        {/* The following pages: each deal's sale price and alerts. */}
        <View break>
          {withResults.map((o) => (
            <DealSection
              key={o.kind}
              kind={o.kind}
              sale={sales.find((sale) => sale.kind === o.kind)}
              result={o.result!}
              warnings={o.result!.warnings.map(labels.warning)}
              labels={labels}
              f={f}
            />
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>observatoriohabitacao.pt</Text>
          <Text
            render={({ pageNumber, totalPages }) => pdfSafe(labels.page(pageNumber, totalPages))}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Column widths of the similar listings' table, adding up to 100 %. */
const CMP = {
  property: "19%",
  area: "8%",
  location: "21%",
  distance: "8%",
  askingPrice: "12%",
  perM2: "10%",
  vsThis: "9%",
  listing: "13%",
} as const;

/**
 * Negócios semelhantes: the property against similar listings, without photos. A line for the
 * property itself, one per listing (with links to it and to its place on the map), then the
 * verdict against their median price per m².
 */
function Comparables({
  summary,
  data,
  labels,
  f,
}: {
  summary: ComparablesSummary;
  data: ReportData;
  labels: ReportLabels;
  f: Formatter;
}) {
  const l = labels.comparables;
  const { state } = data;
  const { opportunity } = summary;
  const anyDifferent = summary.rows.some((r) => r.differences.length > 0);
  const own = {
    label: l.thisProperty,
    type: l.type(state.propertyType, state.bedrooms),
    condition: l.condition(state.condition),
    areaM2: state.areaM2,
    location: [...data.breadcrumb].reverse().slice(0, 2).join(", ") || state.address,
    mapsUrl: googleMapsUrl(state.mapsUrl),
    askingPrice: state.askingPrice,
    pricePerM2: summary.pricePerM2,
    listingUrl: webUrl(state.url),
  };
  return (
    <View>
      <Text style={s.h2}>{pdfSafe(l.title)}</Text>
      <View style={s.table}>
        <View style={s.tr} wrap={false}>
          {(Object.keys(CMP) as (keyof typeof CMP)[]).map((k, i) => (
            <Text
              key={k}
              style={[
                s.th,
                s.cmpHead,
                { width: CMP[k] },
                i === 0 ? { paddingLeft: 0 } : {},
                NUMERIC.has(k) ? { textAlign: "right" } : {},
              ]}
            >
              {pdfSafe(l.columns[k])}
            </Text>
          ))}
        </View>
        <ComparableTr
          name={own.label}
          type={own.type}
          condition={own.condition}
          areaM2={own.areaM2}
          location={own.location}
          mapsUrl={own.mapsUrl}
          distance={null}
          askingPrice={own.askingPrice}
          pricePerM2={own.pricePerM2}
          difference={null}
          listingUrl={own.listingUrl}
          bold
          labels={labels}
          f={f}
        />
        {summary.rows.map((row, i) => (
          <ComparableTr
            key={i}
            name={l.similar(i + 1)}
            type={l.type(row.comparable.propertyType, row.comparable.bedrooms)}
            condition={l.condition(row.comparable.condition)}
            areaM2={row.comparable.areaM2}
            location={row.comparable.location}
            mapsUrl={row.mapsUrl}
            distance={row.distanceKm}
            askingPrice={row.comparable.askingPrice}
            pricePerM2={row.pricePerM2}
            difference={row.difference}
            listingUrl={row.listingUrl}
            differences={row.differences}
            labels={labels}
            f={f}
          />
        ))}
      </View>
      {anyDifferent && <Text style={s.note}>{pdfSafe(l.differentNote)}</Text>}

      <View style={[s.twoCols, { marginTop: 8 }]} wrap={false}>
        <View style={s.col}>
          {summary.tooFew ? (
            <Text style={s.bold}>{pdfSafe(l.tooFew(summary.count))}</Text>
          ) : (
            opportunity && (
              <View>
                <Text
                  style={[
                    s.cmpVerdict,
                    opportunity.signal === "opportunity"
                      ? s.good
                      : opportunity.signal === "above"
                        ? s.negative
                        : {},
                  ]}
                >
                  {pdfSafe(l.verdict(opportunity.signal))}
                </Text>
                <Text>
                  {pdfSafe(
                    l.verdictText(
                      f.signedPercent(opportunity.difference),
                      summary.count,
                      summary.dearer,
                    ),
                  )}
                </Text>
              </View>
            )
          )}
          <Text style={s.note}>{pdfSafe(`${l.vsThisHelp} ${l.note}`)}</Text>
        </View>
        <View style={s.col}>
          {summary.medianPerM2 !== null && (
            <KeyValues
              rows={[
                [l.medianPerM2, f.euroPerM2(summary.medianPerM2)],
                [
                  l.range,
                  `${f.number(Math.round(summary.minPerM2!))} - ${f.euroPerM2(summary.maxPerM2!)}`,
                ],
                ...(summary.medianPrice !== null
                  ? [[l.medianPrice, f.euro(summary.medianPrice)] as Row]
                  : []),
                ...(summary.valueAtMedian !== null
                  ? [[l.valueAtMedian, f.euro(summary.valueAtMedian), { total: true }] as Row]
                  : []),
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const NUMERIC = new Set<keyof typeof CMP>(["area", "distance", "askingPrice", "perM2", "vsThis"]);

/** One line of the similar listings' table; values that set a listing apart are marked "*". */
function ComparableTr({
  name,
  type,
  condition,
  areaM2,
  location,
  mapsUrl,
  distance,
  askingPrice,
  pricePerM2,
  difference,
  listingUrl,
  differences = [],
  bold,
  labels,
  f,
}: {
  name: string;
  type: string;
  condition: string;
  areaM2: number | null;
  location: string;
  mapsUrl: string | null;
  distance: number | null;
  askingPrice: number | null;
  pricePerM2: number | null;
  difference: number | null;
  listingUrl: string | null;
  differences?: ComparableRow["differences"];
  bold?: boolean;
  labels: ReportLabels;
  f: Formatter;
}) {
  const l = labels.comparables;
  const star = (on: boolean) => (on ? "*" : "");
  const cell = (k: keyof typeof CMP) => [
    s.td,
    s.cmpCell,
    { width: CMP[k] },
    NUMERIC.has(k) ? { textAlign: "right" as const } : {},
    bold ? s.bold : {},
  ];
  return (
    <View style={s.tr} wrap={false}>
      <View style={[s.td, { width: CMP.property, paddingLeft: 0 }]}>
        <Text style={[s.cmpCell, s.bold]}>{pdfSafe(name)}</Text>
        <Text style={[s.cmpCell, s.muted]}>
          {pdfSafe(
            `${type}${star(differences.includes("type") || differences.includes("bedrooms"))}${condition ? ` · ${condition}${star(differences.includes("condition"))}` : ""}`,
          )}
        </Text>
      </View>
      <Text style={cell("area")}>
        {pdfSafe(
          areaM2 !== null ? `${f.number(areaM2)} m²${star(differences.includes("area"))}` : "-",
        )}
      </Text>
      <Text style={cell("location")}>{pdfSafe(location || "-")}</Text>
      {/* The distance, with the map link under it: the location then fits in two lines. */}
      <View style={[s.td, { width: CMP.distance, alignItems: "flex-end" }]}>
        {(distance !== null || !mapsUrl) && (
          <Text style={[s.cmpCell, bold ? s.bold : {}]}>
            {pdfSafe(distance !== null ? l.km(f.number(distance, distance < 10 ? 1 : 0)) : "-")}
          </Text>
        )}
        {mapsUrl && (
          <Link src={mapsUrl} style={[s.cmpCell, s.link]}>
            {pdfSafe(l.openMap)}
          </Link>
        )}
      </View>
      <Text style={cell("askingPrice")}>
        {pdfSafe(askingPrice !== null ? f.euro(askingPrice) : "-")}
      </Text>
      <Text style={cell("perM2")}>{pdfSafe(pricePerM2 !== null ? f.euro(pricePerM2) : "-")}</Text>
      <Text
        style={[
          ...cell("vsThis"),
          difference !== null && difference < -0.005 ? s.good : {},
          difference !== null && difference > 0.005 ? s.negative : {},
        ]}
      >
        {pdfSafe(difference !== null ? f.signedPercent(difference, 0) : "-")}
      </Text>
      <View style={[s.td, { width: CMP.listing, paddingRight: 0 }]}>
        {listingUrl ? (
          <Link src={listingUrl} style={[s.cmpCell, s.link]}>
            {pdfSafe(siteName(listingUrl))}
          </Link>
        ) : (
          <Text style={s.cmpCell}>-</Text>
        )}
      </View>
    </View>
  );
}

/** One deal's page section: what its sale must bring in, and its alerts (in small type). */
function DealSection({
  kind,
  sale,
  result,
  warnings,
  labels,
  f,
}: {
  kind: ScenarioKind;
  sale: ReportSale | undefined;
  result: ScenarioResult;
  warnings: string[];
  labels: ReportLabels;
  f: Formatter;
}) {
  return (
    <View wrap={false} style={s.deal}>
      <Text style={[s.h2, { marginTop: 0 }]}>{pdfSafe(labels.scenarioName(kind))}</Text>
      {sale && <SaleSection sale={sale} labels={labels} f={f} />}
      <DealCharts result={result} sale={sale} labels={labels} f={f} />
      {result.gainTax && <GainTaxSection gainTax={result.gainTax} labels={labels} />}
      {warnings.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={s.h3}>{pdfSafe(labels.warnings)}</Text>
          {warnings.map((w) => (
            <Text key={w} style={s.alert}>
              • {pdfSafe(w)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** How the IRS on the gain of the deal's sale is reached, at the price the deal was calculated. */
function GainTaxSection({ gainTax, labels }: { gainTax: GainTax; labels: ReportLabels }) {
  const text = labels.gainTax.describe(gainTax);
  return (
    <View style={[s.twoCols, { marginTop: 8 }]}>
      <View style={s.col}>
        <Text style={s.h3}>{pdfSafe(labels.gainTax.title)}</Text>
        <Text style={[s.muted, { marginBottom: 3 }]}>{pdfSafe(text.price)}</Text>
        <KeyValues
          rows={text.rows.map((row) => [row.label, row.value, { total: row.total }] satisfies Row)}
        />
      </View>
      <View style={[s.col, { paddingTop: 12 }]}>
        {text.notes.map((note) => (
          <Text key={note} style={s.note}>
            {pdfSafe(note)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** What a deal's sale must bring in: the lowest price without a loss, and the profit at yours. */
function SaleSection({
  sale: { kind, analysis, expectedProfit },
  labels,
  f,
}: {
  sale: ReportSale;
  labels: ReportLabels;
  f: Formatter;
}) {
  const { breakEven, expected, years } = analysis;
  return (
    <View>
      <Text style={s.h3}>{pdfSafe(labels.sale.title)}</Text>
      <Text style={[s.note, { marginTop: 0, marginBottom: 5 }]}>
        {pdfSafe(labels.sale.help(kind, years ?? 0))}
      </Text>
      <View style={s.twoCols}>
        <View style={[s.col, s.saleFigure]}>
          <Text style={s.muted}>{pdfSafe(labels.sale.breakEven(kind))}</Text>
          <Text style={s.saleValue}>
            {pdfSafe(breakEven !== null ? f.euro(breakEven) : labels.sale.noBreakEven)}
          </Text>
        </View>
        {expected !== null && (
          <View style={[s.col, s.saleFigure]}>
            <Text style={s.muted}>{pdfSafe(labels.sale.atExpected(expected))}</Text>
            <Text style={[s.saleValue, (expectedProfit ?? 0) < 0 ? s.negative : {}]}>
              {pdfSafe(expectedProfit === null ? "—" : f.euro(expectedProfit))}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** The two charts of a deal, side by side: the waterfall, and the steps on their own scale. */
const WF = { width: 523, height: 150, top: 14, bottom: 24, stepsWidth: 172, gap: 8 };

/** One shade per 5 % step of the sale price, lighter to darker as the price rises. */
const STEP_SHADES = ["#b9d3c6", "#7fae97", "#3f8466", "#1e5b45"];

/**
 * A deal's money as two charts that read as one. On the left, the waterfall: each flow (initial
 * payment, income, costs, loan payments, taxes, the sale) moves the balance up or down, with the
 * sale at the lowest price without a loss, so it ends at 0. On the right, on a larger scale
 * and on the same zero line, the profit at each 5 % step above that price, stacked.
 */
function DealCharts({
  result,
  sale,
  labels,
  f,
}: {
  result: ScenarioResult;
  sale: ReportSale | undefined;
  labels: ReportLabels;
  f: Formatter;
}) {
  // At the steps' base price when there is one; otherwise the deal as calculated.
  const atBase = sale?.baseResult ?? null;
  const bars = waterfallBars(cashBreakdown(atBase ?? result));
  if (bars.length === 0) return null;
  const steps = atBase && sale ? sale.analysis.steps : [];
  // The chart's tax bar explained, unless the chart is at the deal's own price (explained below it).
  const chartTax = (atBase ?? result).gainTax;
  const taxNote =
    chartTax && atBase && Math.abs(chartTax.gain - (result.gainTax?.gain ?? 0)) >= 0.5
      ? labels.gainTax.chartNote(chartTax)
      : null;
  const mainWidth = steps.length ? WF.width - WF.stepsWidth - WF.gap : WF.width;

  // Zero sits at or below the middle, so the steps chart has room to rise from it.
  const values = bars.flatMap((bar) => [bar.from, bar.to]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values, steps.length ? -min : 0);
  const plot = WF.height - WF.top - WF.bottom;
  const y = (v: number) => WF.top + ((max - v) / (max - min || 1)) * plot;
  const zero = y(0);

  return (
    <View style={s.waterfall}>
      <Text style={s.h3}>
        {pdfSafe(
          atBase && sale?.basePrice
            ? labels.breakdown.waterfallAt(sale.analysis.stepsFrom!, f.euro(sale.basePrice))
            : labels.breakdown.waterfall,
        )}
      </Text>
      <View style={{ flexDirection: "row", gap: WF.gap }}>
        <WaterfallChart bars={bars} width={mainWidth} y={y} zero={zero} labels={labels} f={f} />
        {steps.length > 0 && <StepsChart steps={steps} zero={zero} f={f} labels={labels} />}
      </View>
      {taxNote && <Text style={s.note}>{pdfSafe(taxNote)}</Text>}
    </View>
  );
}

/** Thousands as "13k" or "1,2k"; smaller amounts as they are. */
function shortAmount(v: number, f: Formatter): string {
  return Math.abs(v) >= 1000
    ? `${f.number(v / 1000, Math.abs(v) >= 10_000 ? 0 : 1)}k`
    : f.number(Math.round(v));
}

function WaterfallChart({
  bars,
  width,
  y,
  zero,
  labels,
  f,
}: {
  bars: WaterfallBar[];
  width: number;
  y: (v: number) => number;
  zero: number;
  labels: ReportLabels;
  f: Formatter;
}) {
  const slot = width / bars.length;
  const barWidth = Math.min(34, slot * 0.6);
  const colour = (bar: WaterfallBar) =>
    bar.key === "total" ? C.text : bar.value >= 0 ? C.good : C.bad;
  // The result at the lowest price without a loss is 0 (to the euro, within rounding).
  const value = (bar: WaterfallBar) =>
    bar.key === "total" && Math.abs(bar.value) < 100 ? "0" : shortAmount(bar.value, f);
  return (
    <Svg width={width} height={WF.height}>
      <Line x1={0} x2={width} y1={zero} y2={zero} stroke={C.muted} strokeWidth={0.5} />
      {bars.map((bar, i) => {
        const x = slot * i + (slot - barWidth) / 2;
        const top = y(Math.max(bar.from, bar.to));
        const height = Math.max(0.75, Math.abs(y(bar.from) - y(bar.to)));
        const up = bar.to >= bar.from;
        return (
          <G key={bar.key}>
            <Rect x={x} y={top} width={barWidth} height={height} fill={colour(bar)} />
            {i < bars.length - 1 && bar.key !== "total" && (
              <Line
                x1={x + barWidth}
                x2={x + slot}
                y1={y(bar.to)}
                y2={y(bar.to)}
                stroke={C.line}
                strokeWidth={0.75}
              />
            )}
            <Text
              x={x + barWidth / 2}
              y={up || bar.key === "total" ? top - 3 : top + height + 8}
              textAnchor="middle"
              style={bar.key === "total" ? [s.wfValue, s.bold] : s.wfValue}
              fill={colour(bar)}
            >
              {pdfSafe(value(bar))}
            </Text>
            {labelLines(labels.breakdown.short[bar.key], slot, WF_LABEL_SIZE).map(
              (line, n, lines) => (
                <Text
                  key={n}
                  x={slot * i + slot / 2}
                  y={WF.height - 4 - (lines.length - 1 - n) * 7.5}
                  textAnchor="middle"
                  style={s.wfLabel}
                  fill={bar.key === "total" ? C.text : C.muted}
                >
                  {pdfSafe(line)}
                </Text>
              ),
            )}
          </G>
        );
      })}
    </Svg>
  );
}

/**
 * The profit at each 5 % step above the base price, stacked from the same zero line as the
 * waterfall but on its own, larger scale (it would be too small on the waterfall's).
 */
function StepsChart({
  steps,
  zero,
  labels,
  f,
}: {
  steps: SaleStep[];
  zero: number;
  labels: ReportLabels;
  f: Formatter;
}) {
  const base = steps[0]!.profit;
  const top = Math.max(...steps.map((st) => st.profit));
  const room = zero - WF.top;
  const y = (v: number) => zero - ((v - base) / (top - base || 1)) * room;
  const barWidth = 26;
  const x = 10;
  return (
    <Svg width={WF.stepsWidth} height={WF.height}>
      {/* A dashed divider: the scale changes here. */}
      <Line
        x1={0.5}
        x2={0.5}
        y1={WF.top - 6}
        y2={WF.height - WF.bottom}
        stroke={C.line}
        strokeWidth={0.75}
        strokeDasharray="2 2"
      />
      <Line x1={0} x2={WF.stepsWidth} y1={zero} y2={zero} stroke={C.muted} strokeWidth={0.5} />
      {steps.slice(1).map((st, i) => (
        <Rect
          key={st.change}
          x={x}
          y={y(st.profit)}
          width={barWidth}
          height={Math.max(0.75, y(steps[i]!.profit) - y(st.profit))}
          fill={STEP_SHADES[i] ?? C.brand}
        />
      ))}
      {stepLabels(steps.slice(1).map((st) => y(st.profit) + 2.5)).map((labelY, i) => (
        <Text
          key={steps[i + 1]!.change}
          x={x + barWidth + 5}
          y={labelY}
          style={s.wfStep}
          fill={C.muted}
        >
          {pdfSafe(
            `+${Math.round(steps[i + 1]!.change * 100)}%: ${f.euro(steps[i + 1]!.price)} -> ${f.euro(steps[i + 1]!.profit)}`,
          )}
        </Text>
      ))}
      <Text x={x} y={WF.height - 4} style={s.wfLabel} fill={C.text}>
        {pdfSafe(labels.breakdown.short.steps)}
      </Text>
    </Svg>
  );
}

/** Every flow of money per deal over its period, adding up to the result. */
function Breakdown({
  outcomes,
  labels,
  f,
}: {
  outcomes: { kind: ScenarioKind; result?: ScenarioResult | null }[];
  labels: ReportLabels;
  f: Formatter;
}) {
  const deals = outcomes.flatMap((o) =>
    o.result ? [{ kind: o.kind, b: cashBreakdown(o.result) }] : [],
  );
  if (deals.length === 0) return null;
  // Only the kinds of money that some deal has.
  const rows = BREAKDOWN_ROWS.filter((row) => deals.some((d) => Math.abs(d.b.rows[row]) >= 0.5));
  const money = (v: number) => pdfSafe(Math.abs(v) < 0.5 ? "-" : f.euro(v));
  return (
    <View wrap={false}>
      <Text style={s.h2}>{pdfSafe(labels.breakdown.title)}</Text>
      <Text style={[s.muted, { marginBottom: 4 }]}>{pdfSafe(labels.breakdown.help)}</Text>
      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.th, s.metricCell]}> </Text>
          {deals.map((d) => (
            <Text key={d.kind} style={[s.th, s.valueCell]}>
              {pdfSafe(labels.scenario(d.kind))}
            </Text>
          ))}
        </View>
        <View style={s.tr}>
          <Text style={[s.td, s.metricCell, s.muted]}>{pdfSafe(labels.breakdown.period)}</Text>
          {deals.map((d) => (
            <Text key={d.kind} style={[s.td, s.valueCell, s.muted]}>
              {pdfSafe(labels.breakdown.months(d.b.months))}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row} style={s.tr}>
            <Text style={[s.td, s.metricCell, s.label]}>{pdfSafe(labels.breakdown.rows[row])}</Text>
            {deals.map((d) => (
              <Text
                key={d.kind}
                style={[s.td, s.valueCell, d.b.rows[row] < -0.5 ? s.negative : {}]}
              >
                {money(d.b.rows[row])}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.tr}>
          <Text style={[s.th, s.metricCell]}>{pdfSafe(labels.breakdown.total)}</Text>
          {deals.map((d) => (
            <Text key={d.kind} style={[s.th, s.valueCell, d.b.total < -0.5 ? s.negative : {}]}>
              {money(d.b.total)}
            </Text>
          ))}
        </View>
      </View>
      {deals.some((d) => d.kind === "longTermRental") && (
        <Text style={s.note}>{pdfSafe(labels.breakdown.kept)}</Text>
      )}
    </View>
  );
}
