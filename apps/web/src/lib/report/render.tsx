import "server-only";
import { listPhotos, type ScenarioRow } from "@olhovivo/db";
import type { ScenarioKind } from "@olhovivo/engine";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import type { AppLocale } from "@/i18n/routing";
import { chosenOutcomes, runCalculator } from "@/lib/calculator/run";
import { profitAtSale, saleAnalysis } from "@/lib/calculator/sale";
import { getDb } from "@/lib/db";
import { normaliseState } from "@/lib/calculator/state";
import { createFormatter } from "@/lib/format";
import { isListingPhotoUrl } from "@/lib/listingPhotos";
import { googleMapsUrl } from "@/lib/mapsLink";
import { photoFilePath } from "@/lib/photos";
import { BREAKDOWN_ROWS, type BreakdownRow } from "./breakdown";
import { buildReportData, type ReportData } from "./data";
import {
  REPORT_METRICS,
  ScenarioReport,
  type ReportLabels,
  type ReportPhoto,
  type ReportSale,
  type Row,
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
  const f = createFormatter(locale);
  const { state, output } = data;
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "long",
    timeZone: "Europe/Lisbon",
  });
  const money = (v: number | null) => (v === null ? "—" : f.euro(v));
  const pct = (v: number | null) => (v === null ? "—" : f.percent(v));
  const mapsUrl = googleMapsUrl(state.mapsUrl);
  const listingUrl = webUrl(state.url);
  // High, mid and low season, each on its own short row so they fit beside their label.
  const seasonKeys = (["high", "mid", "low"] as const).filter((k) => state.nightlyRate[k] !== null);
  const nightly = seasonKeys.map((k) => money(state.nightlyRate[k])).join(" · ");
  const occupancy = seasonKeys.map((k) => pct(state.occupancy[k])).join(" · ");

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
    scenarioName: (kind: ScenarioKind) => ts(kind),
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
      items: {
        imi: te("annualCostItems.imi"),
        condominium: te("annualCostItems.condominium"),
        insurance: te("annualCostItems.insurance"),
        maintenance: te("annualCostItems.maintenance"),
      },
      total: ta("total"),
      months: (months) => t("breakdown.months", { months }),
      holdingNote: t("holdingNote"),
    },
    sale: {
      title: tsale("title"),
      breakEven: (kind) => tsale(`breakEven.${kind}`),
      noBreakEven: tsale("noBreakEven"),
      atExpected: (price) => tsale("atExpected", { price: f.euro(price) }),
      help: (kind, years) => tsale(`help.${kind}`, { years }),
      caption: (from) => tsale(`stepsCaption.${from}`),
      priceLabel: (kind) => tsale(`priceLabel.${kind}`),
    },
    breakdown: {
      short: Object.fromEntries(
        [...BREAKDOWN_ROWS, "total" as const, "steps" as const].map((row) => [
          row,
          t(`breakdown.short.${row}`),
        ]),
      ) as Record<BreakdownRow | "total" | "steps", string>,
      waterfall: t("breakdown.waterfall"),
      waterfallAt: (from, price) => t(`breakdown.waterfallAt.${from}`, { price }),
      title: t("breakdown.title"),
      help: t("breakdown.help"),
      period: t("breakdown.period"),
      months: (months) => t("breakdown.months", { months }),
      rows: Object.fromEntries(
        BREAKDOWN_ROWS.map((row) => [row, t(`breakdown.rows.${row}`)]),
      ) as Record<BreakdownRow, string>,
      total: t("breakdown.total"),
      kept: t("breakdown.kept"),
    },
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
        ...(output.opportunity
          ? [
              [
                t("askingVsMarket"),
                `${te(`opportunity.${output.opportunity.signal}`)} (${f.signedPercent(output.opportunity.difference)})`,
              ] as [string, string],
            ]
          : []),
        // A short label for the link: a long address cannot wrap without breaking words.
        ...(listingUrl
          ? [
              [
                t("listing"),
                t("openListing", { site: new URL(listingUrl).hostname.replace(/^www\./, "") }),
                { href: listingUrl },
              ] as Row,
            ]
          : []),
        ...(mapsUrl ? [[t("map"), te("openMaps"), { href: mapsUrl }] as Row] : []),
      ],
      market: [
        [te("marketValue"), money(state.marketValue)],
        [te("resaleValue"), money(state.resaleValue)],
        [te("monthlyRent"), money(state.monthlyRent)],
        ...(seasonKeys.length
          ? [
              [te("nightlyRates"), nightly] as [string, string],
              [te("occupancyRates"), occupancy] as [string, string],
            ]
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
 * property's photos are private: in the owner's report, and in the shared one only when the
 * owner chose to show them.
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
    if (!analysis) return [];
    const expectedProfit =
      analysis.expected !== null
        ? profitAtSale(state, parameters, startMonth, o.kind, analysis.expected)
        : null;
    // The deal with the sale at the price the steps start from (the lowest price without a
    // loss, or the price entered when no price makes a loss): what the waterfall shows.
    const basePrice = analysis.steps[0]?.price ?? null;
    const baseResult =
      basePrice !== null
        ? (runCalculator(state, parameters, startMonth, { only: o.kind, salePrice: basePrice })
            .outcomes[0]?.result ?? null)
        : null;
    return [{ kind: o.kind, analysis, expectedProfit, basePrice, baseResult }];
  });
}

/** The listing link, when it is a web address (it becomes a clickable link in the PDF). */
function webUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A main photo and up to five more, smaller. */
const REPORT_PHOTOS = 6;

/**
 * The photos for the report, as JPEG (the PDF format has no WebP), small enough for it: the
 * photos the owner uploaded, or else the listing's own photos. The first is the main photo.
 */
async function reportPhotos(scenario: ScenarioRow): Promise<ReportPhoto[]> {
  const rows = (listPhotos(getDb(), scenario.id, scenario.userId) ?? []).slice(0, REPORT_PHOTOS);
  const sources: (() => Promise<Buffer | null>)[] = rows.length
    ? rows.map((row) => async () => readFile(photoFilePath(scenario.id, row.fileName)))
    : normaliseState(scenario.inputs)
        .listingPhotos.slice(0, REPORT_PHOTOS)
        .map((url) => () => downloadListingPhoto(url));
  const photos = await Promise.all(
    sources.map(async (source): Promise<ReportPhoto | null> => {
      try {
        const input = await source();
        if (!input) return null;
        const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
          .rotate()
          .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer({ resolveWithObject: true });
        return { data, width: info.width, height: info.height };
      } catch (error) {
        console.error("report photo failed", error);
        return null;
      }
    }),
  );
  return photos.filter((p): p is ReportPhoto => p !== null);
}

const LISTING_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Downloads one listing photo from the listing site's image server (and nowhere else: the
 * address comes from the user's saved inputs), with a time and size limit.
 */
async function downloadListingPhoto(url: string): Promise<Buffer | null> {
  if (!isListingPhotoUrl(url)) return null;
  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "image/jpeg,image/png,image/webp,image/*" },
  });
  if (!res.ok || !res.body) return null;
  if (Number(res.headers.get("content-length") ?? 0) > LISTING_PHOTO_MAX_BYTES) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > LISTING_PHOTO_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks);
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
