"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { FEATURE_LABEL, floorLabel } from "@/lib/calculator/labels";
import { TrendChart } from "@/components/prices/TrendChart";
import { HelpTip } from "@/components/shared/HelpTip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Formatter } from "@/lib/format";
import { formatPeriod } from "@/lib/period";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { COEFFICIENTS_SOURCE, formatCoefficient } from "@/lib/valuation/coefficients";
import type { Adjustment, Valuation } from "@/lib/valuation/estimate";
import { MODEL_VERSION, NEGOTIATION_MARGIN } from "@/lib/valuation/model";
import type { Proceeds, SellerGainLineKey } from "@/lib/valuation/proceeds";
import type { ValuationState } from "@/lib/valuation/state";

/** Step 4 of Vender: the value, how it was reached, pricing advice and what the seller keeps. */
export function ValuationResult({
  state,
  valuation,
  series,
  proceeds,
  onEditSale,
}: {
  state: ValuationState;
  valuation: Valuation;
  /** The INE median over time, for the area the base comes from. */
  series: { period: string; value: number }[];
  /** Null until the sale step is filled in (or skipped). */
  proceeds: Proceeds | null;
  onEditSale: () => void;
}) {
  const t = useTranslations("sell");
  const tp = useTranslations("prices");
  const f = useFormat();
  const period = (p: string) => formatPeriod((key, values) => tp(key, values), p);
  const v = valuation;

  return (
    <div className="space-y-6">
      <ValueCard valuation={v} areaM2={state.areaM2!} f={f} />

      <PricingAdvice valuation={v} areaM2={state.areaM2!} f={f} />

      {series.length > 1 && v.ine && (
        <TrendChart
          title={t("trendTitle", { area: v.ine.areaName })}
          summary={t("trendSummary", {
            from: period(series[0]!.period),
            to: period(series.at(-1)!.period),
            first: f.euroPerM2(series[0]!.value),
            last: f.euroPerM2(series.at(-1)!.value),
          })}
          points={series.map((p) => ({ label: period(p.period), value: p.value }))}
          color="var(--chart-1)"
          seriesName={t("trendSeries")}
        />
      )}

      <Breakdown state={state} valuation={v} f={f} period={period} />

      {proceeds ? (
        <ProceedsCard proceeds={proceeds} f={f} onEdit={onEditSale} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div>
            <h3 className="font-semibold">{t("proceedsTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("proceedsPrompt")}</p>
          </div>
          <Button variant="outline" onClick={onEditSale}>
            {t("proceedsAdd")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ValueCard({
  valuation: v,
  areaM2,
  f,
}: {
  valuation: Valuation;
  areaM2: number;
  f: Formatter;
}) {
  const t = useTranslations("sell");
  return (
    <section className="space-y-3 rounded-lg bg-muted/50 p-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm text-muted-foreground">{t("likelyValue")}</h3>
        <Badge
          className={cn(
            v.confidence === "high" && "bg-positive text-background",
            v.confidence === "medium" && "bg-secondary text-secondary-foreground",
            v.confidence === "low" && "bg-amber-600 text-white",
          )}
        >
          {t(`confidence.${v.confidence}`)}
        </Badge>
      </div>
      <p className="text-4xl font-semibold tracking-tight tabular-nums">{f.euro(v.likely)}</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">{t("range")}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {f.euro(v.low)} – {f.euro(v.high)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("perM2")}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {f.euroPerM2(v.perM2)} · {f.number(areaM2)} m²
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("basedOn")}</dt>
          <dd className="text-sm">
            {v.ine ? t("basedOnIne") : ""}
            {v.ine && v.comparables.length > 0 ? " + " : ""}
            {v.comparables.length > 0 ? t("basedOnListings", { count: v.comparables.length }) : ""}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">{t(`confidenceText.${v.confidence}`)}</p>
    </section>
  );
}

function PricingAdvice({
  valuation: v,
  areaM2,
  f,
}: {
  valuation: Valuation;
  areaM2: number;
  f: Formatter;
}) {
  const t = useTranslations("sell");
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{t("adviceTitle")}</h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("askingPrice")}
            <HelpTip label={t("askingPrice")} text={t("askingPriceHelp")} />
          </dt>
          <dd className="text-lg font-semibold tabular-nums">{f.euro(v.askingPrice)}</dd>
          <dd className="text-xs text-muted-foreground">{f.euroPerM2(v.askingPrice / areaM2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("expectedSale")}</dt>
          <dd className="text-lg font-semibold tabular-nums">{f.euro(v.likely)}</dd>
          <dd className="text-xs text-muted-foreground">{f.euroPerM2(v.perM2)}</dd>
        </div>
        {v.comparablesAskingPerM2 !== null && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("listingsAsking")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {f.euroPerM2(v.comparablesAskingPerM2)}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {t("listingsAskingSub", { count: v.comparables.length })}
            </dd>
          </div>
        )}
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t("adviceMargin")}</li>
        {v.ine?.yearOnYear !== null && v.ine?.yearOnYear !== undefined && (
          <li>
            {t("adviceTrend", {
              change: f.signedPercent(v.ine.yearOnYear),
              area: v.ine.areaName,
            })}
          </li>
        )}
        {v.comparablesAskingPerM2 !== null && (
          <li>
            {t("adviceListings", {
              diff: f.signedPercent(v.askingPrice / areaM2 / v.comparablesAskingPerM2 - 1),
            })}
          </li>
        )}
      </ul>
    </section>
  );
}

/** Each line from the INE median and the similar listings to the property's value. */
function Breakdown({
  state,
  valuation: v,
  f,
  period,
}: {
  state: ValuationState;
  valuation: Valuation;
  f: Formatter;
  period: (p: string) => string;
}) {
  const t = useTranslations("sell");
  const tc = useTranslations("comparables");
  const id = useId();
  return (
    <details className="group rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">{t("howTitle")}</summary>
      <div className="mt-4 space-y-4 text-sm">
        <table className="w-full">
          <caption className="sr-only">{t("howTitle")}</caption>
          <tbody className="divide-y">
            {v.ine ? (
              <Row
                label={t("howIne", { area: v.ine.areaName, period: period(v.ine.period) })}
                value={f.euroPerM2(v.ine.value)}
              />
            ) : (
              <Row label={t("howNoIne")} value="—" />
            )}
            {v.comparables.length > 0 && (
              <Row
                label={t("howListings", {
                  count: v.comparables.length,
                  weight: f.percent(v.weight, 0),
                })}
                value={v.comparablesMedian !== null ? f.euroPerM2(v.comparablesMedian) : "—"}
              />
            )}
            <Row label={t("howBase")} value={f.euroPerM2(v.basePerM2)} strong />
            <AdjustmentRows adjustment={v.subject} state={state} f={f} />
            <Row
              label={t("howResult", { area: f.number(state.areaM2!) })}
              value={`${f.euroPerM2(v.perM2)} → ${f.euro(v.likely)}`}
              strong
            />
          </tbody>
        </table>

        {v.comparables.length > 0 && (
          <div className="space-y-2">
            <h4 id={`${id}-listings`} className="font-medium">
              {t("howListingsTitle")}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs" aria-labelledby={`${id}-listings`}>
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 font-normal">{tc("columns.property")}</th>
                    <th className="py-1 text-right font-normal">{t("colAsking")}</th>
                    <th className="py-1 pl-4 font-normal">{t("colAdjustment")}</th>
                    <th className="py-1 text-right font-normal">{t("colStandard")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {v.comparables.map((c) => (
                    <tr key={c.index}>
                      <td className="py-1.5">{tc("similar", { n: c.index + 1 })}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {f.euroPerM2(c.askingPerM2)}
                      </td>
                      <td className="py-1.5 pl-4">{adjustmentText(c.adjustment, t, tc, f)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {f.euroPerM2(c.standardPerM2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("howListingsNote", { margin: f.percent(NEGOTIATION_MARGIN, 0) })}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t("howAssumptions", { version: MODEL_VERSION })}
        </p>
      </div>
    </details>
  );
}

function AdjustmentRows({
  adjustment: a,
  state,
  f,
}: {
  adjustment: Adjustment;
  state: ValuationState;
  f: Formatter;
}) {
  const t = useTranslations("sell");
  const te = useTranslations("evaluate");
  const tc = useTranslations("comparables");
  return (
    <>
      <Row
        label={t("howCondition", { condition: te(`conditions.${a.condition}`) })}
        value={a.conditionFactor === 1 ? "—" : f.signedPercent(a.conditionFactor - 1, 0)}
      />
      {a.shortfalls.map((s) => (
        <Row
          key={s.feature}
          label={
            s.feature === "elevator" && state.floor !== null
              ? t("howNoElevator", { floor: floorLabel(state.floor, tc) })
              : t("howMissing", { feature: te(FEATURE_LABEL[s.feature]).toLowerCase() })
          }
          value={f.signedPercent(-s.penalty, 0)}
        />
      ))}
    </>
  );
}

/** "Usado · sem elevador −10 %" for a listing's adjustment. */
function adjustmentText(
  a: Adjustment,
  t: ReturnType<typeof useTranslations<"sell">>,
  tc: ReturnType<typeof useTranslations<"comparables">>,
  f: Formatter,
): string {
  const parts = [
    ...(a.conditionFactor !== 1
      ? [t("adjCondition", { change: f.signedPercent(a.conditionFactor - 1, 0) })]
      : []),
    ...a.shortfalls.map((s) => `${tc(`without.${s.feature}`)} ${f.signedPercent(-s.penalty, 0)}`),
  ];
  return parts.length > 0 ? parts.join(" · ") : t("adjNone");
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={cn(strong && "font-semibold")}>
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 text-right tabular-nums whitespace-nowrap">{value}</td>
    </tr>
  );
}

const GAIN_LINE_KEYS: Record<SellerGainLineKey, string> = {
  salePrice: "gainSalePrice",
  sellingCommission: "gainCommission",
  otherCosts: "gainOtherCosts",
  purchasePrice: "gainPurchasePrice",
  monetaryCorrection: "gainCorrection",
  purchaseCosts: "gainPurchaseCosts",
  works: "gainWorks",
};

/** What the seller keeps: the price down to the net amount, with the IRS on the gain. */
function ProceedsCard({
  proceeds: p,
  f,
  onEdit,
}: {
  proceeds: Proceeds;
  f: Formatter;
  onEdit: () => void;
}) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const id = useId();
  const g = p.gainTax;
  const minus = (v: number) => (v === 0 ? f.euro(0) : `− ${f.euro(v)}`);
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="font-semibold">
          {t("proceedsTitle")}
        </h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("proceedsEdit")}
        </Button>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("proceedsTitle")}</caption>
        <tbody className="divide-y">
          <Row label={t("netSalePrice")} value={f.euro(p.salePrice)} />
          <Row
            label={t("netCommission", {
              rate: f.percent(p.commissionRate, 1),
              vat: f.percent(p.vatRate, 0),
            })}
            value={minus(p.commission)}
          />
          {p.otherCosts > 0 && <Row label={t("netOtherCosts")} value={minus(p.otherCosts)} />}
          <Row label={t("netIrs")} value={g ? minus(g.tax) : t("netIrsUnknown")} />
          {p.loanBalance > 0 && <Row label={t("netLoan")} value={minus(p.loanBalance)} />}
          {p.earlyRepaymentFee > 0 && (
            <Row label={t("netEarlyRepayment")} value={minus(p.earlyRepaymentFee)} />
          )}
          <Row label={t("netTotal")} value={f.euro(p.net)} strong />
        </tbody>
      </table>

      {g ? (
        <details className="rounded-md bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("gainTitle")}</summary>
          {g.untaxed ? (
            <p className="mt-2">{t("gainUntaxed")}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <table className="w-full">
                <tbody className="divide-y">
                  {g.lines
                    .filter((l) => l.amount !== 0)
                    .map((l) => (
                      <Row
                        key={l.key}
                        label={
                          l.key === "monetaryCorrection"
                            ? t("gainCorrection", {
                                coefficient: formatCoefficient(g.coefficient, locale),
                                source: COEFFICIENTS_SOURCE,
                              })
                            : t(GAIN_LINE_KEYS[l.key] as "gainSalePrice")
                        }
                        value={l.amount < 0 ? minus(-l.amount) : f.euro(l.amount)}
                      />
                    ))}
                  <Row label={t("gainTotal")} value={f.euro(g.gain)} strong />
                  {g.reinvestedShare > 0 && (
                    <Row
                      label={t("gainReinvested")}
                      value={`− ${f.percent(g.reinvestedShare, 0)}`}
                    />
                  )}
                  <Row
                    label={t("gainTaxable", { share: f.percent(g.inclusionRate, 0) })}
                    value={f.euro(g.taxable)}
                  />
                  <Row label={t("gainIrs")} value={f.euro(g.tax)} strong />
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                {g.gain <= 0
                  ? t("gainNone")
                  : t("gainNote", { income: f.euro(g.otherTaxableIncome) })}
              </p>
            </div>
          )}
        </details>
      ) : (
        <p className="text-sm text-muted-foreground">{t("netIrsHint")}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("proceedsNote")}</p>
    </section>
  );
}
