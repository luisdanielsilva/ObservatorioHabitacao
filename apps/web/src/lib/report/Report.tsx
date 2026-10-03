import type { ScenarioKind, ScenarioResult } from "@olhovivo/engine";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Formatter } from "@/lib/format";
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
  best: string | null;
  missing: string;
  warnings: string;
  parameters: string;
  disclaimer: string;
  page: (page: number, total: number) => string;
  scenario: (kind: ScenarioKind) => string;
  metric: { key: MetricKey; label: string }[];
  metricHeader: string;
  acquisition: { label: string; items: [keyof AcquisitionItems, string][]; total: string };
  warning: (code: string) => string;
  years: (n: number) => string;
  rows: { property: [string, string][]; market: [string, string][]; purchase: [string, string][] };
}

type AcquisitionItems = NonNullable<ScenarioResult["acquisition"]>;

export type MetricKey =
  | "netProfit"
  | "irr"
  | "roi"
  | "monthlyCashFlow"
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
  best: "#e6f4f3",
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
  table: { borderTopWidth: 0.5, borderTopColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: { fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 3 },
  td: { paddingVertical: 3, paddingHorizontal: 3 },
  metricCell: { width: "28%" },
  valueCell: { width: "18%", textAlign: "right" },
  bestCell: { backgroundColor: C.best },
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
          <Text style={s.muted}>{pdfSafe(k)}</Text>
          <Text>{pdfSafe(v)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ScenarioReport({
  data,
  labels,
  f,
}: {
  data: ReportData;
  labels: ReportLabels;
  f: Formatter;
}) {
  const { output } = data;
  const best = output.comparison.best;
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
        {labels.best && <Text style={{ marginBottom: 4 }}>{pdfSafe(labels.best)}</Text>}
        <View style={s.table} wrap={false}>
          <View style={s.tr}>
            <Text style={[s.th, s.metricCell]}>{pdfSafe(labels.metricHeader)}</Text>
            {output.outcomes.map((o) => (
              <Text key={o.kind} style={[s.th, s.valueCell, best === o.kind ? s.bestCell : {}]}>
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
          {REPORT_METRICS.map(({ key, format: kind }) => (
            <View key={key} style={s.tr}>
              <Text style={[s.td, s.metricCell]}>
                {pdfSafe(labels.metric.find((m) => m.key === key)?.label ?? key)}
              </Text>
              {output.outcomes.map((o) => {
                const v = o.result ? o.result[key] : null;
                return (
                  <Text
                    key={o.kind}
                    style={[
                      s.td,
                      s.valueCell,
                      best === o.kind ? s.bestCell : {},
                      v !== null && v < 0 ? s.negative : {},
                    ]}
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
      </Page>
    </Document>
  );
}
