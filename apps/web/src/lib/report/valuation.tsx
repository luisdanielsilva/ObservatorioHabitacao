import {
  getActiveParameterSet,
  getAreaBreadcrumb,
  getMarketReference,
  getMarketSeries,
  type ValuationRow,
} from "@observatorio-habitacao/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { webUrl } from "@/lib/calculator/comparables";
import { hasTypology } from "@/lib/calculator/flow";
import { FEATURE_LABEL, floorLabel } from "@/lib/calculator/labels";
import { FEATURES, type PropertyType } from "@/lib/calculator/state";
import { getDb } from "@/lib/db";
import { createFormatter } from "@/lib/format";
import { googleMapsUrl } from "@/lib/mapsLink";
import { formatPeriod } from "@/lib/period";
import { COEFFICIENTS_SOURCE, formatCoefficient } from "@/lib/valuation/coefficients";
import { estimateValue, type Adjustment } from "@/lib/valuation/estimate";
import { ineBase } from "@/lib/valuation/ine";
import { MODEL_VERSION, NEGOTIATION_MARGIN } from "@/lib/valuation/model";
import { sellerProceeds } from "@/lib/valuation/proceeds";
import { hasSaleDetails, normaliseValuation } from "@/lib/valuation/state";
import type { Row } from "./Report";
import { ValuationReport, type ValuationReportContent } from "./ValuationReport";

const SERIES_POINTS = 9;

/**
 * Renders the PDF report of a saved valuation, recalculated from what the seller entered with
 * today's INE data; undefined when it cannot be valued.
 */
export async function renderValuationPdf(
  row: ValuationRow,
  locale: AppLocale,
): Promise<Buffer | undefined> {
  const db = getDb();
  const state = normaliseValuation(row.input);
  const reference =
    state.areaId !== null ? getMarketReference(db, state.areaId, "sale_eur_m2_median") : undefined;
  const valuation = estimateValue(state, ineBase(reference ?? null));
  if (!valuation) return undefined;
  const params = getActiveParameterSet(db, "continente", new Date().getFullYear());
  const saleYear = new Date().getFullYear();
  const proceeds =
    params && hasSaleDetails(state)
      ? sellerProceeds(state, state.salePrice ?? valuation.likely, params.data, saleYear)
      : null;
  const series = reference
    ? getMarketSeries(db, reference.areaId, "sale_eur_m2_median").slice(-SERIES_POINTS)
    : [];

  const t = await getTranslations({ locale, namespace: "sell" });
  const te = await getTranslations({ locale, namespace: "evaluate" });
  const tc = await getTranslations({ locale, namespace: "comparables" });
  const tp = await getTranslations({ locale, namespace: "prices" });
  const f = createFormatter(locale);
  const period = (p: string) => formatPeriod((key, values) => tp(key, values), p);
  const type = (pt: PropertyType, bedrooms: number | null) =>
    `${te(`types.${pt}`)}${hasTypology(pt) && bedrooms !== null ? ` T${bedrooms === 5 ? "5+" : bedrooms}` : ""}`;
  const minus = (v: number) => (v === 0 ? f.euro(0) : `− ${f.euro(v)}`);
  const relevant = FEATURES.filter(
    (k) => k !== "elevator" || state.propertyType === "apartamento",
  ).filter((k) => k !== "balcony" || state.propertyType === "apartamento");
  const has = relevant.filter((k) => state.features[k]).map((k) => te(FEATURE_LABEL[k]));
  const lacks = relevant.filter((k) => !state.features[k]).map((k) => te(FEATURE_LABEL[k]));
  const location =
    state.areaId !== null
      ? getAreaBreadcrumb(db, state.areaId)
          .slice(1)
          .reverse()
          .map((a) => a.name)
          .join(", ")
      : "";
  const maps = googleMapsUrl(state.mapsUrl);
  const adjustment = (a: Adjustment) => {
    const parts = [
      ...(a.conditionFactor !== 1
        ? [t("adjCondition", { change: f.signedPercent(a.conditionFactor - 1, 0) })]
        : []),
      ...a.shortfalls.map(
        (sf) => `${tc(`without.${sf.feature}`)} ${f.signedPercent(-sf.penalty, 0)}`,
      ),
    ];
    return parts.length > 0 ? parts.join(" · ") : t("adjNone");
  };
  const v = valuation;
  const area = state.areaM2!;

  const howRows: Row[] = [
    v.ine
      ? [
          t("howIne", { area: v.ine.areaName, period: period(v.ine.period) }),
          f.euroPerM2(v.ine.value),
        ]
      : [t("howNoIne"), "—"],
    ...(v.comparables.length > 0
      ? [
          [
            t("howListings", { count: v.comparables.length, weight: f.percent(v.weight, 0) }),
            v.comparablesMedian !== null ? f.euroPerM2(v.comparablesMedian) : "—",
          ] as Row,
        ]
      : []),
    [t("howBase"), f.euroPerM2(v.basePerM2), { total: true }],
    [
      t("howCondition", { condition: te(`conditions.${v.subject.condition}`) }),
      v.subject.conditionFactor === 1 ? "—" : f.signedPercent(v.subject.conditionFactor - 1, 0),
    ],
    ...v.subject.shortfalls.map((sf): Row => [
      sf.feature === "elevator" && state.floor !== null
        ? t("howNoElevator", { floor: floorLabel(state.floor, tc) })
        : t("howMissing", { feature: te(FEATURE_LABEL[sf.feature]).toLowerCase() }),
      f.signedPercent(-sf.penalty, 0),
    ]),
    [
      t("howResult", { area: f.number(area) }),
      `${f.euroPerM2(v.perM2)} -> ${f.euro(v.likely)}`,
      { total: true },
    ],
  ];

  const g = proceeds?.gainTax ?? null;
  const gainLabel: Record<string, string> = {
    salePrice: t("gainSalePrice"),
    sellingCommission: t("gainCommission"),
    otherCosts: t("gainOtherCosts"),
    purchasePrice: t("gainPurchasePrice"),
    monetaryCorrection: g
      ? t("gainCorrection", {
          coefficient: formatCoefficient(g.coefficient, locale),
          source: COEFFICIENTS_SOURCE,
        })
      : "",
    purchaseCosts: t("gainPurchaseCosts"),
    works: t("gainWorks"),
  };

  const content: ValuationReportContent = {
    title: row.name || type(state.propertyType, state.bedrooms),
    subtitle: t("pdfSubtitle"),
    generated: t("pdfGenerated", {
      date: new Date().toLocaleDateString(locale === "en" ? "en-IE" : "pt-PT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    }),
    property: {
      title: t("stepProperty"),
      rows: [
        [te("propertyType"), type(state.propertyType, state.bedrooms)],
        [te("areaM2"), `${f.number(area)} m²`],
        [te("condition"), te(`conditions.${state.condition}`)],
        ...(state.propertyType === "apartamento" && state.floor !== null
          ? [[tc("floor"), floorLabel(state.floor, tc)] as Row]
          : []),
        ...(has.length > 0 ? [[t("pdfHas"), has.join(", ")] as Row] : []),
        ...(lacks.length > 0 ? [[t("pdfLacks"), lacks.join(", ")] as Row] : []),
        ...(location ? [[t("location"), location] as Row] : []),
        ...(maps ? [[t("pdfMap"), t("pdfOpenMap"), { href: maps }] as Row] : []),
      ],
    },
    value: {
      title: t("pdfValue"),
      likelyLabel: t("likelyValue"),
      confidence: t(`confidence.${v.confidence}`),
      rows: [
        [t("range"), `${f.euro(v.low)} – ${f.euro(v.high)}`],
        [t("perM2"), f.euroPerM2(v.perM2)],
      ],
      note: t(`confidenceText.${v.confidence}`),
    },
    advice: {
      title: t("adviceTitle"),
      rows: [
        [
          t("askingPrice"),
          `${f.euro(v.askingPrice)} (${f.euroPerM2(v.askingPrice / area)})`,
          { total: true },
        ],
        [t("expectedSale"), `${f.euro(v.likely)} (${f.euroPerM2(v.perM2)})`],
        ...(v.comparablesAskingPerM2 !== null
          ? [
              [
                t("listingsAsking"),
                `${f.euroPerM2(v.comparablesAskingPerM2)} (${t("listingsAskingSub", { count: v.comparables.length })})`,
              ] as Row,
            ]
          : []),
      ],
      points: [
        t("askingPriceHelp"),
        t("adviceMargin"),
        ...(v.ine && v.ine.yearOnYear !== null
          ? [t("adviceTrend", { change: f.signedPercent(v.ine.yearOnYear), area: v.ine.areaName })]
          : []),
      ],
    },
    trend:
      series.length > 1 && v.ine
        ? {
            title: t("trendTitle", { area: v.ine.areaName }),
            points: series.map((p) => ({ label: period(p.period), value: p.value })),
          }
        : null,
    how: {
      title: t("howTitle"),
      rows: howRows,
      note: t("howAssumptions", { version: MODEL_VERSION }),
    },
    comparables:
      v.comparables.length > 0
        ? {
            title: t("howListingsTitle"),
            columns: [
              tc("columns.property"),
              t("pdfDetails"),
              tc("columns.askingPrice"),
              t("colAsking"),
              t("colAdjustment"),
              t("colStandard"),
            ],
            rows: v.comparables.map((cv) => {
              const c = state.comparables[cv.index]!;
              const detail = [
                type(c.propertyType, c.bedrooms),
                c.areaM2 !== null ? `${f.number(c.areaM2)} m²` : null,
                c.condition ? te(`conditions.${c.condition}`) : null,
                c.floor !== null ? floorLabel(c.floor, tc) : null,
                ...FEATURES.filter((k) => c.features[k] === false).map((k) => tc(`without.${k}`)),
                c.location || null,
              ]
                .filter(Boolean)
                .join(" · ");
              return {
                name: tc("similar", { n: cv.index + 1 }),
                detail,
                asking: c.askingPrice !== null ? f.euro(c.askingPrice) : "—",
                askingPerM2: f.euroPerM2(cv.askingPerM2),
                adjustment: adjustment(cv.adjustment),
                standard: f.euroPerM2(cv.standardPerM2),
                href: webUrl(c.url),
              };
            }),
            note: t("howListingsNote", { margin: f.percent(NEGOTIATION_MARGIN, 0) }),
          }
        : null,
    proceeds: proceeds
      ? {
          title: t("proceedsTitle"),
          rows: [
            [t("netSalePrice"), f.euro(proceeds.salePrice)],
            [
              t("netCommission", {
                rate: f.percent(proceeds.commissionRate, 1),
                vat: f.percent(proceeds.vatRate, 0),
              }),
              minus(proceeds.commission),
            ],
            ...(proceeds.otherCosts > 0
              ? [[t("netOtherCosts"), minus(proceeds.otherCosts)] as Row]
              : []),
            [t("netIrs"), g ? minus(g.tax) : t("netIrsUnknown")],
            ...(proceeds.loanBalance > 0
              ? [[t("netLoan"), minus(proceeds.loanBalance)] as Row]
              : []),
            ...(proceeds.earlyRepaymentFee > 0
              ? [[t("netEarlyRepayment"), minus(proceeds.earlyRepaymentFee)] as Row]
              : []),
            [t("netTotal"), f.euro(proceeds.net), { total: true }],
          ],
          gainTitle: g ? t("gainTitle") : null,
          gainRows: !g
            ? []
            : g.untaxed
              ? [[t("gainUntaxed"), f.euro(0)]]
              : [
                  ...g.lines
                    .filter((l) => l.amount !== 0)
                    .map((l): Row => [
                      gainLabel[l.key]!,
                      l.amount < 0 ? minus(-l.amount) : f.euro(l.amount),
                    ]),
                  [t("gainTotal"), f.euro(g.gain), { total: true }],
                  ...(g.reinvestedShare > 0
                    ? [[t("gainReinvested"), `− ${f.percent(g.reinvestedShare, 0)}`] as Row]
                    : []),
                  [t("gainTaxable", { share: f.percent(g.inclusionRate, 0) }), f.euro(g.taxable)],
                  [t("gainIrs"), f.euro(g.tax), { total: true }],
                ],
          note: [
            g && !g.untaxed
              ? g.gain <= 0
                ? t("gainNone")
                : t("gainNote", { income: f.euro(g.otherTaxableIncome) })
              : null,
            t("proceedsNote"),
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    disclaimer: t("disclaimer"),
    page: (n, total) => t("pdfPage", { n, total }),
  };

  return renderToBuffer(<ValuationReport content={content} valuation={v} f={f} />);
}
