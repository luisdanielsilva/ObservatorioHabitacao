import { chosenOutcomes } from "@/lib/calculator/run";
import type { ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import {
  Document,
  Font,
  G,
  Image,
  Line,
  Link,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { COST_ITEMS, ownershipCosts, type CostItem } from "@/lib/calculator/costs";
import { nearStep, type SaleAnalysis } from "@/lib/calculator/sale";
import type { Formatter } from "@/lib/format";
import { BREAKDOWN_ROWS, cashBreakdown, type BreakdownRow, waterfallBars } from "./breakdown";
import type { ReportData } from "./data";
import { pdfSafe } from "./text";

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
    nearExpected: string;
  };
  breakdown: {
    /** Short names under the waterfall's bars. */
    short: Record<BreakdownRow | "total", string>;
    waterfall: string;
    title: string;
    help: string;
    period: string;
    months: (months: number) => string;
    rows: Record<BreakdownRow, string>;
    total: string;
    kept: string;
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

const C = {
  text: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  brand: "#0e7c7b",
  bad: "#b91c1c",
  good: "#15803d",
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: C.text, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 1.5 },
  stepChange: { width: 30 },
  stepPrice: { width: 95 },
  stepNear: { fontSize: 7, fontFamily: "Helvetica", color: C.muted },
  good: { color: C.good },
  stepTrack: { flex: 1, height: 8, marginRight: 8 },
  stepBar: { height: 8, backgroundColor: C.brand, minWidth: 1 },
  stepProfit: { width: 62, textAlign: "right" },
  saleCards: { width: "38%", gap: 6 },
  waterfall: { marginTop: 8 },
  wfValue: { fontSize: 7 },
  wfLabel: { fontSize: 7 },
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

function KeyValues({ rows }: { rows: Row[] }) {
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
  const acquisition = withResults.find((o) => o.result?.acquisition)?.result?.acquisition;
  const annual = withResults.flatMap((o) => {
    const costs = ownershipCosts(o.kind, o.result!);
    return costs ? [{ kind: o.kind, costs }] : [];
  });

  return (
    <Document
      title={pdfSafe(`${labels.title} - ${data.name}`)}
      author="OlhoVivo"
      creator="OlhoVivo"
    >
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text style={s.brand}>
            Olho<Text style={s.brandAccent}>Vivo</Text>
          </Text>
          <Text style={s.muted}>{pdfSafe(labels.generated)}</Text>
        </View>

        <Text style={s.h1}>{pdfSafe(data.name)}</Text>
        <Text style={s.muted}>{pdfSafe(labels.title)}</Text>

        {photos.length > 0 && (
          <View style={s.photos} wrap={false}>
            {/* The main photo, then up to five more, smaller. Alt text does not apply here. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={{ data: photos[0]!.data, format: "jpg" }} style={s.mainPhoto} />
            {photos.length > 1 && (
              <View style={s.thumbs}>
                {photos.slice(1, 6).map((p, i) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image key={i} src={{ data: p.data, format: "jpg" }} style={s.thumb} />
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

        <Text style={s.h2}>{pdfSafe(labels.purchase)}</Text>
        <KeyValues rows={labels.rows.purchase} />

        {/* Page 2: the summary. The heading stays with its table. */}
        <View wrap={false} break>
          <Text style={[s.h2, { marginTop: 0 }]}>{pdfSafe(labels.results)}</Text>
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
          <Text>olhovivo.pt</Text>
          <Text
            render={({ pageNumber, totalPages }) => pdfSafe(labels.page(pageNumber, totalPages))}
          />
        </View>
      </Page>
    </Document>
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
      <Waterfall result={result} labels={labels} f={f} />
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

/** What a deal's sale must bring in: break-even price, and profit in 5 % steps above it. */
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
        <View style={s.saleCards}>
          <View style={s.saleFigure}>
            <Text style={s.muted}>{pdfSafe(labels.sale.breakEven(kind))}</Text>
            <Text style={s.saleValue}>
              {pdfSafe(breakEven !== null ? f.euro(breakEven) : labels.sale.noBreakEven)}
            </Text>
          </View>
          {expected !== null && (
            <View style={s.saleFigure}>
              <Text style={s.muted}>{pdfSafe(labels.sale.atExpected(expected))}</Text>
              <Text style={[s.saleValue, (expectedProfit ?? 0) < 0 ? s.negative : {}]}>
                {pdfSafe(expectedProfit === null ? "—" : f.euro(expectedProfit))}
              </Text>
            </View>
          )}
        </View>
        {analysis.stepsFrom && (
          <View style={s.col}>
            <Text style={[s.note, { marginTop: 0, marginBottom: 3 }]}>
              {pdfSafe(labels.sale.caption(analysis.stepsFrom))}
            </Text>
            <SaleSteps analysis={analysis} labels={labels} f={f} />
          </View>
        )}
      </View>
    </View>
  );
}

const WF = { width: 523, height: 120, top: 12, bottom: 24 };

/**
 * The calculation summary of one deal as a waterfall: each flow of money (initial payment,
 * income, costs, loan payments, taxes, the sale) moves the balance up or down, ending at the
 * result. Same figures as "Resumo do cálculo".
 */
function Waterfall({
  result,
  labels,
  f,
}: {
  result: ScenarioResult;
  labels: ReportLabels;
  f: Formatter;
}) {
  const bars = waterfallBars(cashBreakdown(result));
  if (bars.length === 0) return null;
  const values = bars.flatMap((bar) => [bar.from, bar.to]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const plot = WF.height - WF.top - WF.bottom;
  const y = (v: number) => WF.top + ((max - v) / (max - min || 1)) * plot;
  const slot = WF.width / bars.length;
  const barWidth = Math.min(36, slot * 0.6);
  const short = (v: number) =>
    Math.abs(v) >= 1000 ? `${f.number(v / 1000, Math.abs(v) >= 10_000 ? 0 : 1)}k` : f.number(v);
  const colour = (bar: (typeof bars)[number]) =>
    bar.key === "total" ? C.text : bar.value >= 0 ? C.good : C.bad;

  return (
    <View style={s.waterfall}>
      <Text style={s.h3}>{pdfSafe(labels.breakdown.waterfall)}</Text>
      <Svg width={WF.width} height={WF.height}>
        <Line x1={0} x2={WF.width} y1={y(0)} y2={y(0)} stroke={C.muted} strokeWidth={0.5} />
        {bars.map((bar, i) => {
          const x = slot * i + (slot - barWidth) / 2;
          const top = y(Math.max(bar.from, bar.to));
          const height = Math.max(0.75, Math.abs(y(bar.from) - y(bar.to)));
          const up = bar.to >= bar.from;
          return (
            <G key={bar.key}>
              <Rect x={x} y={top} width={barWidth} height={height} fill={colour(bar)} />
              {/* A thin connector to the next bar, at the new balance. */}
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
                style={s.wfValue}
                fill={colour(bar)}
              >
                {pdfSafe(short(bar.value))}
              </Text>
              <Text
                x={slot * i + slot / 2}
                y={WF.height - 4}
                textAnchor="middle"
                style={s.wfLabel}
                fill={bar.key === "total" ? C.text : C.muted}
              >
                {pdfSafe(labels.breakdown.short[bar.key])}
              </Text>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/** Net profit in 5 % steps above the base price, as horizontal bars. */
function SaleSteps({
  analysis,
  labels,
  f,
}: {
  analysis: SaleAnalysis;
  labels: ReportLabels;
  f: Formatter;
}) {
  const { steps, expected } = analysis;
  const maxProfit = Math.max(1, ...steps.map((st) => st.profit));
  const near = nearStep(steps, expected);
  return (
    <View>
      {steps.map((st, i) => (
        <View key={st.change} style={s.stepRow}>
          <Text style={[s.stepChange, s.muted]}>
            {st.change === 0 ? "0%" : `+${Math.round(st.change * 100)}%`}
          </Text>
          <Text style={[s.stepPrice, i === near ? { fontFamily: "Helvetica-Bold" } : {}]}>
            {pdfSafe(f.euro(st.price))}
            {i === near && (
              <Text style={s.stepNear}>{pdfSafe(`  ${labels.sale.nearExpected}`)}</Text>
            )}
          </Text>
          <View style={s.stepTrack}>
            <View
              style={[s.stepBar, { width: `${(Math.max(0, st.profit) / maxProfit) * 100}%` }]}
            />
          </View>
          <Text style={[s.stepProfit, st.profit < 0 ? s.negative : {}]}>
            {pdfSafe(f.euro(st.profit))}
          </Text>
        </View>
      ))}
    </View>
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
