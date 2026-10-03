import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/i18n/locale";
import { createFormatter } from "@/lib/format";
import { loadSharedScenario } from "@/lib/report/shared";

export const alt = "OlhoVivo";
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

  const best = shared?.data.output.comparison.best;
  const result = best
    ? shared?.data.output.outcomes.find((o) => o.kind === best)?.result
    : undefined;
  const figures = result
    ? [
        [tm("netProfit"), f.euro(result.netProfit)],
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
        Olho<span style={{ color: "#4fd1c5" }}>Vivo</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>
          {shared ? shared.scenario.name.slice(0, 70) : t("ogNoResults")}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#4fd1c5" }}>
          {best ? t("ogBest", { scenario: ts(best) }) : t("ogNoResults")}
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
