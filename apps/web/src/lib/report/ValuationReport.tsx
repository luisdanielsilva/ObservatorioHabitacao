import { Document, Link, Page, Text, View } from "@react-pdf/renderer";
import type { Formatter } from "@/lib/format";
import type { Valuation } from "@/lib/valuation/estimate";
import { C, KeyValues, PdfBrand, s, type Row } from "./Report";
import { pdfSafe } from "./text";

/** Everything the seller's report shows, already worded in the report's language. */
export interface ValuationReportContent {
  title: string;
  subtitle: string;
  generated: string;
  property: { title: string; rows: Row[] };
  value: { title: string; likelyLabel: string; confidence: string; rows: Row[]; note: string };
  advice: { title: string; rows: Row[]; points: string[] };
  trend: { title: string; points: { label: string; value: number }[] } | null;
  how: { title: string; rows: Row[]; note: string };
  comparables: {
    title: string;
    columns: [string, string, string, string, string, string];
    rows: {
      name: string;
      detail: string;
      asking: string;
      askingPerM2: string;
      adjustment: string;
      standard: string;
      href: string | null;
    }[];
    note: string;
  } | null;
  proceeds: {
    title: string;
    rows: Row[];
    gainTitle: string | null;
    gainRows: Row[];
    note: string;
  } | null;
  disclaimer: string;
  page: (n: number, total: number) => string;
}

const cmp = { fontSize: 7.5 };

/** The seller's valuation report (Vender): value, advice, how it was reached, what they keep. */
export function ValuationReport({
  content: c,
  valuation,
  f,
}: {
  content: ValuationReportContent;
  valuation: Valuation;
  f: Formatter;
}) {
  return (
    <Document
      title={pdfSafe(`${c.subtitle} - ${c.title}`)}
      author="Observatório Habitação"
      creator="Observatório Habitação"
    >
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <PdfBrand />
          <Text style={s.muted}>{pdfSafe(c.generated)}</Text>
        </View>

        <Text style={s.h1}>{pdfSafe(c.title)}</Text>
        <Text style={s.muted}>{pdfSafe(c.subtitle)}</Text>

        <View style={[s.twoCols, { marginTop: 8 }]}>
          <View style={s.col}>
            <Text style={s.h2}>{pdfSafe(c.property.title)}</Text>
            <KeyValues rows={c.property.rows} />
          </View>
          <View style={s.col}>
            <Text style={s.h2}>{pdfSafe(c.value.title)}</Text>
            <Text style={s.muted}>{pdfSafe(`${c.value.likelyLabel} · ${c.value.confidence}`)}</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", marginVertical: 4 }}>
              {pdfSafe(f.euro(valuation.likely))}
            </Text>
            <KeyValues rows={c.value.rows} />
            <Text style={s.note}>{pdfSafe(c.value.note)}</Text>
          </View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>{pdfSafe(c.advice.title)}</Text>
          <KeyValues rows={c.advice.rows} />
          {c.advice.points.map((p) => (
            <Text key={p} style={s.note}>
              {pdfSafe(`- ${p}`)}
            </Text>
          ))}
        </View>

        {c.trend && <TrendBars title={c.trend.title} points={c.trend.points} f={f} />}

        <View wrap={false}>
          <Text style={s.h2}>{pdfSafe(c.how.title)}</Text>
          <KeyValues rows={c.how.rows} />
          <Text style={s.note}>{pdfSafe(c.how.note)}</Text>
        </View>

        {c.comparables && (
          <View>
            <Text style={s.h2}>{pdfSafe(c.comparables.title)}</Text>
            <View style={s.table}>
              <View style={s.tr}>
                {c.comparables.columns.map((col, i) => (
                  <Text
                    key={col}
                    style={[
                      s.th,
                      cmp,
                      { width: COLS[i], textAlign: i >= 2 && i !== 4 ? "right" : "left" },
                    ]}
                  >
                    {pdfSafe(col)}
                  </Text>
                ))}
              </View>
              {c.comparables.rows.map((r) => (
                <View key={r.name} style={s.tr} wrap={false}>
                  <View style={[s.td, { width: COLS[0] }]}>
                    {r.href ? (
                      <Link src={r.href} style={[cmp, s.link]}>
                        {pdfSafe(r.name)}
                      </Link>
                    ) : (
                      <Text style={[cmp, s.bold]}>{pdfSafe(r.name)}</Text>
                    )}
                  </View>
                  <Text style={[s.td, cmp, { width: COLS[1] }]}>{pdfSafe(r.detail)}</Text>
                  <Text style={[s.td, cmp, { width: COLS[2], textAlign: "right" }]}>
                    {pdfSafe(r.asking)}
                  </Text>
                  <Text style={[s.td, cmp, { width: COLS[3], textAlign: "right" }]}>
                    {pdfSafe(r.askingPerM2)}
                  </Text>
                  <Text style={[s.td, cmp, { width: COLS[4] }]}>{pdfSafe(r.adjustment)}</Text>
                  <Text style={[s.td, cmp, { width: COLS[5], textAlign: "right" }]}>
                    {pdfSafe(r.standard)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.note}>{pdfSafe(c.comparables.note)}</Text>
          </View>
        )}

        {c.proceeds && (
          <View wrap={false}>
            <Text style={s.h2}>{pdfSafe(c.proceeds.title)}</Text>
            <KeyValues rows={c.proceeds.rows} />
            {c.proceeds.gainTitle && (
              <>
                <Text style={[s.h3, { marginTop: 8 }]}>{pdfSafe(c.proceeds.gainTitle)}</Text>
                <KeyValues rows={c.proceeds.gainRows} />
              </>
            )}
            <Text style={s.note}>{pdfSafe(c.proceeds.note)}</Text>
          </View>
        )}

        <Text style={s.disclaimer}>{pdfSafe(c.disclaimer)}</Text>

        <View style={s.footer} fixed>
          <Text>observatoriohabitacao.pt</Text>
          <Text render={({ pageNumber, totalPages }) => pdfSafe(c.page(pageNumber, totalPages))} />
        </View>
      </Page>
    </Document>
  );
}

const COLS = ["13%", "27%", "13%", "12%", "22%", "13%"] as const;

/** The INE median over time as simple bars, from the lowest value shown. */
function TrendBars({
  title,
  points,
  f,
}: {
  title: string;
  points: { label: string; value: number }[];
  f: Formatter;
}) {
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const floor = min - (max - min || max * 0.1) * 0.5;
  return (
    <View wrap={false}>
      <Text style={s.h2}>{pdfSafe(title)}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 80 }}>
        {points.map((p) => (
          <View key={p.label} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 6.5, marginBottom: 2 }}>{pdfSafe(f.number(p.value))}</Text>
            <View
              style={{
                width: "70%",
                height: Math.max(4, ((p.value - floor) / (max - floor)) * 56),
                backgroundColor: C.brand,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
        {points.map((p) => (
          <Text key={p.label} style={{ flex: 1, fontSize: 6, textAlign: "center", color: C.muted }}>
            {pdfSafe(p.label)}
          </Text>
        ))}
      </View>
    </View>
  );
}
