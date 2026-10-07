import { chosenOutcomes } from "@/lib/calculator/run";
import type { ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import {
  Circle,
  Document,
  Image,
  Line,
  Page,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { SaleAnalysis } from "@/lib/calculator/sale";
import type { Formatter } from "@/lib/format";
import { BREAKDOWN_ROWS, cashBreakdown, type BreakdownRow } from "./breakdown";
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
  metric: { key: MetricKey; label: string }[];
  metricHeader: string;
  acquisition: { label: string; items: [keyof AcquisitionItems, string][]; total: string };
  annualCosts: { label: string; items: [keyof AnnualCosts, string][]; total: string };
  sale: {
    title: string;
    breakEven: (kind: ScenarioKind) => string;
    noBreakEven: string;
    atExpected: (price: number) => string;
    help: (kind: ScenarioKind, years: number) => string;
    caption: string;
    priceLabel: (kind: ScenarioKind) => string;
    profit: string;
  };
  photos: string;
  breakdown: {
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
  rows: { property: [string, string][]; market: [string, string][]; purchase: [string, string][] };
}

type AcquisitionItems = NonNullable<ScenarioResult["acquisition"]>;
type AnnualCosts = NonNullable<ScenarioResult["annualFixedCosts"]>;

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

const C = {
  text: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  brand: "#0e7c7b",
  bad: "#b91c1c",
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
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  // Long values (a listing link, seasonal rates) wrap under their own column.
  kvLabel: { maxWidth: "50%", paddingRight: 8 },
  kvValue: { flex: 1, textAlign: "right" },
  table: { borderTopWidth: 0.5, borderTopColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: { fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 3 },
  td: { paddingVertical: 3, paddingHorizontal: 3 },
  metricCell: { width: "28%" },
  valueCell: { width: "18%", textAlign: "right" },
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
  saleBox: { marginTop: 4, marginBottom: 6 },
  saleFigures: { flexDirection: "row", gap: 16, marginBottom: 4 },
  saleFigure: { flex: 1, padding: 6, borderWidth: 0.5, borderColor: C.line },
  saleValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  axis: { fontSize: 7, color: C.muted },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  photo: { width: "48.5%", objectFit: "cover" },
  disclaimer: {
    marginTop: 14,
    padding: 8,
    borderWidth: 0.5,
    borderColor: C.line,
    fontSize: 8,
    color: C.muted,
  },
});

function KeyValues({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([k, v]) => (
        <View key={k} style={s.kv}>
          <Text style={[s.muted, s.kvLabel]}>{pdfSafe(k)}</Text>
          <Text style={s.kvValue}>{pdfSafe(v)}</Text>
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
  const annual = withResults.filter((o) => o.result!.annualFixedCosts);
  const warnings = [
    ...new Set(
      withResults.flatMap((o) =>
        o.result!.warnings.map((w) => `${labels.scenario(o.kind)}: ${labels.warning(w)}`),
      ),
    ),
  ];

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

        <Text style={s.h2}>{pdfSafe(labels.results)}</Text>
        <View style={s.table} wrap={false}>
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
              <Text style={[s.td, s.metricCell]}>
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

        {acquisition && (
          <View wrap={false}>
            <Text style={s.h2}>{pdfSafe(labels.acquisition.label)}</Text>
            <KeyValues
              rows={[
                ...labels.acquisition.items
                  .filter(([k]) => acquisition[k] > 0)
                  .map(([k, label]) => [label, f.euro(acquisition[k])] as [string, string]),
                [labels.acquisition.total, f.euro(acquisition.total)],
              ]}
            />
          </View>
        )}

        {annual.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>{pdfSafe(labels.annualCosts.label)}</Text>
            <View style={s.table}>
              <View style={s.tr}>
                <Text style={[s.th, s.metricCell]}> </Text>
                {annual.map((o) => (
                  <Text key={o.kind} style={[s.th, s.valueCell]}>
                    {pdfSafe(labels.scenario(o.kind))}
                  </Text>
                ))}
              </View>
              {[...labels.annualCosts.items, ["total", labels.annualCosts.total] as const].map(
                ([k, label]) => (
                  <View key={k} style={s.tr}>
                    <Text style={[s.td, s.metricCell, k === "total" ? s.th : {}]}>
                      {pdfSafe(label)}
                    </Text>
                    {annual.map((o) => {
                      const c = o.result!.annualFixedCosts!;
                      const v = k === "total" ? c.imi + c.condominium + c.insurance : c[k];
                      return (
                        <Text key={o.kind} style={[s.td, s.valueCell, k === "total" ? s.th : {}]}>
                          {pdfSafe(f.euro(v))}
                        </Text>
                      );
                    })}
                  </View>
                ),
              )}
            </View>
          </View>
        )}

        <Breakdown outcomes={withResults} labels={labels} f={f} />

        {sales.map((sale) => (
          <SaleSection key={sale.kind} sale={sale} labels={labels} f={f} />
        ))}

        {warnings.length > 0 && (
          <View>
            <Text style={s.h2}>{pdfSafe(labels.warnings)}</Text>
            {warnings.map((w) => (
              <Text key={w} style={{ marginBottom: 2 }}>
                • {pdfSafe(w)}
              </Text>
            ))}
          </View>
        )}

        <Text style={s.note}>{pdfSafe(labels.parameters)}</Text>
        <View style={s.disclaimer} wrap={false}>
          <Text>{pdfSafe(labels.disclaimer)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>olhovivo.pt</Text>
          <Text
            render={({ pageNumber, totalPages }) => pdfSafe(labels.page(pageNumber, totalPages))}
          />
        </View>

        {photos.length > 0 && (
          <View break>
            <Text style={s.h2}>{pdfSafe(labels.photos)}</Text>
            <View style={s.photoGrid}>
              {photos.map((p, i) => (
                // Alt text does not apply to PDF images here.
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  key={i}
                  src={{ data: p.data, format: "jpg" }}
                  style={[s.photo, { aspectRatio: p.width / p.height }]}
                />
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

/** What a deal's sale must bring in: break-even price, profit at the expected price, chart. */
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
    <View wrap={false} style={s.saleBox}>
      <Text style={s.h2}>{pdfSafe(`${labels.sale.title}: ${labels.scenario(kind)}`)}</Text>
      <Text style={[s.muted, { marginBottom: 4 }]}>
        {pdfSafe(labels.sale.help(kind, years ?? 0))}
      </Text>
      <View style={s.saleFigures}>
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
      <SaleCurve analysis={analysis} />
      <Text style={s.note}>{pdfSafe(labels.sale.caption)}</Text>
    </View>
  );
}

const CHART = { width: 523, height: 130, left: 40, bottom: 14, top: 6, right: 8 };

/** Net profit by sale price, from the break-even price up, drawn as a line chart. */
function SaleCurve({ analysis: { points, breakEven, expected } }: { analysis: SaleAnalysis }) {
  const minX = points[0]!.price;
  const maxX = points.at(-1)!.price;
  const profits = points.map((p) => p.profit);
  const minY = Math.min(0, ...profits);
  const maxY = Math.max(0, ...profits) || 1;
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const x = (v: number) => CHART.left + ((v - minX) / (maxX - minX || 1)) * plotW;
  const y = (v: number) => CHART.top + (1 - (v - minY) / (maxY - minY)) * plotH;
  const k = (v: number) => `${Math.round(v / 1000)}k`;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minX + (maxX - minX) * t);
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <Svg width={CHART.width} height={CHART.height}>
      {yTicks.map((v) => (
        <Line
          key={`y${v}`}
          x1={CHART.left}
          x2={CHART.width - CHART.right}
          y1={y(v)}
          y2={y(v)}
          stroke={C.line}
          strokeWidth={0.5}
        />
      ))}
      <Line
        x1={CHART.left}
        x2={CHART.width - CHART.right}
        y1={y(0)}
        y2={y(0)}
        stroke={C.muted}
        strokeWidth={0.75}
        strokeDasharray="4 3"
      />
      {expected !== null && expected >= minX && expected <= maxX && (
        <Line
          x1={x(expected)}
          x2={x(expected)}
          y1={CHART.top}
          y2={CHART.top + plotH}
          stroke={C.muted}
          strokeWidth={0.75}
          strokeDasharray="2 3"
        />
      )}
      <Polyline
        points={points.map((p) => `${x(p.price)},${y(p.profit)}`).join(" ")}
        stroke={C.brand}
        strokeWidth={1.5}
        fill="none"
      />
      {breakEven !== null && <Circle cx={x(breakEven)} cy={y(0)} r={3} fill={C.brand} />}
      {yTicks.map((v) => (
        <Text key={`yl${v}`} x={CHART.left - 4} y={y(v) + 2} style={s.axis} textAnchor="end">
          {k(v)}
        </Text>
      ))}
      {xTicks.map((v) => (
        <Text key={`xl${v}`} x={x(v)} y={CHART.height - 2} style={s.axis} textAnchor="middle">
          {k(v)}
        </Text>
      ))}
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
            <Text style={[s.td, s.metricCell]}>{pdfSafe(labels.breakdown.rows[row])}</Text>
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
