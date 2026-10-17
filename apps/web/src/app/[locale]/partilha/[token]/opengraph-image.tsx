import { chosenOutcomes } from "@/lib/calculator/run";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/i18n/locale";
import { createFormatter } from "@/lib/format";
import { loadSharedScenario } from "@/lib/report/shared";

export const alt = "Observatório Habitação";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Preview image for X / Facebook: the scenario name and its best option. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const t = await getTranslations({ locale, namespace: "share" });
  const ts = await getTranslations({ locale, namespace: "scenarios" });
  const tm = await getTranslations({ locale, namespace: "metrics" });
  const f = createFormatter(locale);
  const shared = loadSharedScenario(token);

  // The chosen deals with results; the first one's figures are shown, none is ranked.
  const evaluated = shared
    ? chosenOutcomes(shared.data.output, shared.data.state.deals).filter((o) => o.result)
    : [];
  const result = evaluated[0]?.result;
  const figures = result
    ? [
        result.netProfit !== null
          ? [tm("netProfit"), f.euro(result.netProfit)]
          : [tm("monthlyCashFlow"), f.euro(result.monthlyCashFlow ?? 0)],
        [tm("irr"), result.irr === null ? "—" : f.percent(result.irr)],
        ...(result.netYield !== null ? [[tm("netYield"), f.percent(result.netYield)]] : []),
      ]
    : [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#11171d",
        color: "#f3f4f6",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
        Observatório&nbsp;<span style={{ color: "#4fd1c5" }}>Habitação</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>
          {shared ? shared.scenario.name.slice(0, 70) : t("ogNoResults")}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#4fd1c5" }}>
          {evaluated.length > 0 ? evaluated.map((o) => ts(o.kind)).join(" · ") : t("ogNoResults")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 56 }}>
        {figures.map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 24, color: "#9ca3af" }}>{label}</span>
            <span style={{ fontSize: 44, fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
