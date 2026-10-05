import "server-only";
import { listPhotos, type ScenarioRow } from "@olhovivo/db";
import type { ScenarioKind } from "@olhovivo/engine";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import type { AppLocale } from "@/i18n/routing";
import { chosenOutcomes } from "@/lib/calculator/run";
import { profitAtSale, saleAnalysis } from "@/lib/calculator/sale";
import { getDb } from "@/lib/db";
import { createFormatter } from "@/lib/format";
import { photoFilePath } from "@/lib/photos";
import { buildReportData, type ReportData } from "./data";
import {
  REPORT_METRICS,
  ScenarioReport,
  type ReportLabels,
  type ReportPhoto,
  type ReportSale,
} from "./Report";
export { reportFilename } from "./text";

/** Translated labels and value rows for a report, in `locale`. */
export async function reportLabels(data: ReportData, locale: AppLocale): Promise<ReportLabels> {
  const t = await getTranslations({ locale, namespace: "share.report" });
  const te = await getTranslations({ locale, namespace: "evaluate" });
  const tm = await getTranslations({ locale, namespace: "metrics" });
  const ts = await getTranslations({ locale, namespace: "scenarios" });
  const ta = await getTranslations({ locale, namespace: "acquisition" });
  const tw = await getTranslations({ locale, namespace: "warnings" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tsale = await getTranslations({ locale, namespace: "sale" });
  const tp = await getTranslations({ locale, namespace: "photos" });
  const f = createFormatter(locale);
  const { state, output } = data;
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "long",
    timeZone: "Europe/Lisbon",
  });
  const money = (v: number | null) => (v === null ? "—" : f.euro(v));
  const pct = (v: number | null) => (v === null ? "—" : f.percent(v));
  const seasons = (["high", "mid", "low"] as const)
    .filter((k) => state.nightlyRate[k] !== null)
    .map((k) => `${money(state.nightlyRate[k])} / ${pct(state.occupancy[k])}`)
    .join(" · ");

  return {
    title: t("title"),
    generated: t("generated", { date: dateFormat.format(new Date()) }),
    property: t("property"),
    location: t("location"),
    marketReference: te("marketReference"),
    medianSale: te("medianSale"),
    medianRent: te("medianRent"),
    marketValues: t("marketValues"),
    purchase: t("purchase"),
    results: t("results"),
    missing: t("missing"),
    warnings: te("warningsTitle"),
    parameters: t("parameters", {
      year: data.parametersYear,
      verified: String(data.parametersVerified),
      date: dateFormat.format(new Date(`${data.updatedAt.replace(" ", "T")}Z`)),
    }),
    disclaimer: tc("disclaimer"),
    page: (page, total) => t("page", { page, total }),
    scenario: (kind: ScenarioKind) => ts(`${kind}Short`),
    metricHeader: te("metric"),
    metric: REPORT_METRICS.map(({ key }) => ({ key, label: tm(key) })),
    acquisition: {
      label: tm("acquisitionCosts"),
      items: [
        ["imt", ta("imt")],
        ["stampDutyPurchase", ta("stampDutyPurchase")],
        ["stampDutyLoan", ta("stampDutyLoan")],
        ["deedAndRegistry", ta("deedAndRegistry")],
        ["valuationFee", ta("valuationFee")],
        ["processingFee", ta("processingFee")],
      ],
      total: ta("total"),
    },
    annualCosts: {
      label: te("annualCosts"),
      items: [
        ["imi", te("annualCostItems.imi")],
        ["condominium", te("annualCostItems.condominium")],
        ["insurance", te("annualCostItems.insurance")],
      ],
      total: ta("total"),
    },
    sale: {
      title: tsale("title"),
      breakEven: (kind) => tsale(`breakEven.${kind}`),
      noBreakEven: tsale("noBreakEven"),
      atExpected: (price) => tsale("atExpected", { price: f.euro(price) }),
      help: (kind, years) => tsale(`help.${kind}`, { years }),
      caption: tsale("chartCaption"),
      priceLabel: (kind) => tsale(`priceLabel.${kind}`),
      profit: tsale("profit"),
    },
    photos: tp("title"),
    warning: (code) => (tw.has(code as never) ? tw(code as never) : code),
    years: (n) => tm("years", { value: n }),
    rows: {
      property: [
        [
          te("propertyType"),
          `${te(`types.${state.propertyType}`)}${state.bedrooms !== null ? ` T${state.bedrooms === 5 ? "5+" : state.bedrooms}` : ""}`,
        ],
        [te("areaM2"), state.areaM2 ? `${f.number(state.areaM2)} m²` : "—"],
        [te("condition"), te(`conditions.${state.condition}`)],
        [t("location"), data.breadcrumb.join(" › ") || state.address || "—"],
        [te("askingPrice"), money(state.askingPrice)],
      ],
      market: [
        [te("marketValue"), money(state.marketValue)],
        [te("resaleValue"), money(state.resaleValue)],
        [te("monthlyRent"), money(state.monthlyRent)],
        ...(seasons
          ? [[`${te("nightlyRates")} / ${te("occupancyRates")}`, seasons] as [string, string]]
          : []),
        ...(state.deposit !== null
          ? [
              [te("cpcvPrice"), money(state.cpcvPrice ?? output.purchasePrice)] as [string, string],
              [te("deposit"), money(state.deposit)] as [string, string],
              [te("assignmentPrice"), money(state.assignmentPrice)] as [string, string],
            ]
          : []),
      ],
      purchase: [
        [te("purchasePrice"), money(output.purchasePrice)],
        [te("renovationBudget"), money(state.renovationBudget)],
        [
          t("loan"),
          output.loanAmount > 0
            ? `${f.euro(output.loanAmount)} · ${f.percent(state.interestRate, 2)} · ${state.loanTermYears} ${te("yearsShort")}`
            : t("noLoan"),
        ],
        [te("flipMonths"), `${state.flipMonths} ${te("monthsShort")}`],
        [te("holdingYears"), `${state.rentalYears} ${te("yearsShort")}`],
        [
          te("otherTaxableIncome"),
          state.otherTaxableIncome !== null ? f.euro(state.otherTaxableIncome) : "—",
        ],
      ],
    },
  };
}

/**
 * Renders the PDF report of a saved scenario, or undefined if it cannot be calculated. The
 * property's photos are private: only in the owner's report, never in a shared one.
 */
export async function renderScenarioPdf(
  scenario: ScenarioRow,
  locale: AppLocale,
  { photos = false }: { photos?: boolean } = {},
): Promise<Buffer | undefined> {
  const data = buildReportData(scenario);
  if (!data) return undefined;
  const labels = await reportLabels(data, locale);
  return renderToBuffer(
    <ScenarioReport
      data={data}
      labels={labels}
      f={createFormatter(locale)}
      sales={reportSales(data)}
      photos={photos ? await reportPhotos(scenario) : []}
    />,
  );
}

/** The sale-price analysis of each chosen deal with results, as on the results page. */
function reportSales(data: ReportData): ReportSale[] {
  const { state, parameters, startMonth } = data;
  return chosenOutcomes(data.output, state.deals).flatMap((o) => {
    if (!o.result) return [];
    const analysis = saleAnalysis(state, parameters, startMonth, o.kind);
    if (!analysis || analysis.points.length === 0) return [];
    const expectedProfit =
      analysis.expected !== null
        ? profitAtSale(state, parameters, startMonth, o.kind, analysis.expected)
        : null;
    return [{ kind: o.kind, analysis, expectedProfit }];
  });
}

/** The scenario's photos as JPEG (the PDF format has no WebP), small enough for a report. */
async function reportPhotos(scenario: ScenarioRow): Promise<ReportPhoto[]> {
  const rows = listPhotos(getDb(), scenario.id, scenario.userId) ?? [];
  const photos = await Promise.all(
    rows.map(async (row): Promise<ReportPhoto | null> => {
      try {
        const { data, info } = await sharp(photoFilePath(scenario.id, row.fileName))
          .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer({ resolveWithObject: true });
        return { data, width: info.width, height: info.height };
      } catch (error) {
        console.error("report photo failed", row.id, error);
        return null;
      }
    }),
  );
  return photos.filter((p): p is ReportPhoto => p !== null);
}

export function pdfResponse(pdf: Buffer, filename: string, disposition: "inline" | "attachment") {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
