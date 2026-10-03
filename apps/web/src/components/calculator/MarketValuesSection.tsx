"use client";

import type { Opportunity, Seasonal } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { Badge } from "@/components/ui/badge";
import { HelpTip } from "@/components/shared/HelpTip";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import type { Update } from "./Calculator";
import { NumberField, NumberInput, Section, SwitchField } from "./fields";

const SEASONS = ["high", "mid", "low"] as const;

export function MarketValuesSection({
  state,
  update,
  reference,
  opportunity,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  reference: ReferenceResponse | null;
  opportunity: Opportunity | null;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const id = useId();
  const seasonLabel = {
    high: t("seasonHigh"),
    mid: t("seasonMid"),
    low: t("seasonLow"),
  } as const;

  // Reference hints: what the INE medians imply for this property's area.
  const m2 = state.areaM2;
  const saleHint =
    reference?.sale && m2
      ? `≈ ${f.euro(reference.sale.value * m2)} (INE × ${f.number(m2)} m²)`
      : undefined;
  const rentHint =
    reference?.rent && m2
      ? `≈ ${f.euro(reference.rent.value * m2)} (INE × ${f.number(m2)} m²)`
      : undefined;

  const setSeason = (
    key: "nightlyRate" | "occupancy",
    season: keyof Seasonal<unknown>,
    value: number | null,
  ) => update({ [key]: { ...state[key], [season]: value } });

  return (
    <Section title={t("stepMarket")} description={t("marketValuesIntro")} id={`${id}-market`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("marketValue")}
          help={t("marketValueHelp")}
          kind="money"
          value={state.marketValue}
          onChange={(marketValue) => update({ marketValue })}
          hint={saleHint}
          locale={locale}
        />
        <NumberField
          label={t("resaleValue")}
          help={t("resaleValueHelp")}
          kind="money"
          value={state.resaleValue}
          onChange={(resaleValue) => update({ resaleValue })}
          locale={locale}
        />
        <NumberField
          label={t("monthlyRent")}
          help={t("monthlyRentHelp")}
          kind="money"
          value={state.monthlyRent}
          onChange={(monthlyRent) => update({ monthlyRent })}
          hint={rentHint}
          locale={locale}
        />
      </div>

      {opportunity && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <Badge
            className={cn(
              opportunity.signal === "opportunity" && "bg-positive text-background",
              opportunity.signal === "fair" && "bg-secondary text-secondary-foreground",
              opportunity.signal === "above" && "bg-destructive text-white",
            )}
          >
            {t(`opportunity.${opportunity.signal}`)}
          </Badge>
          <span className="text-muted-foreground">
            {t("opportunity.text", { diff: f.signedPercent(opportunity.difference) })}
          </span>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1 text-sm font-medium">
          {t("nightlyRates")} / {t("occupancyRates")}
          <HelpTip
            label={t("nightlyRates")}
            text={`${t("nightlyRatesHelp")} ${t("occupancyRatesHelp")}`}
          />
        </legend>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  <span className="sr-only">{t("metric")}</span>
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("nightlyRates")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("occupancyRates")}
                </th>
              </tr>
            </thead>
            <tbody>
              {SEASONS.map((season) => (
                <tr key={season} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {seasonLabel[season]}
                  </th>
                  <td className="px-2 py-1.5">
                    <NumberInput
                      kind="money"
                      value={state.nightlyRate[season]}
                      onChange={(v) => setSeason("nightlyRate", season, v)}
                      locale={locale}
                      aria-describedby={undefined}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumberInput
                      kind="percent"
                      value={state.occupancy[season]}
                      onChange={(v) =>
                        setSeason("occupancy", season, v === null ? null : Math.min(1, v))
                      }
                      locale={locale}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t("cessaoTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("cpcvPrice")}
            help={t("cpcvPriceHelp")}
            kind="money"
            value={state.cpcvPrice}
            placeholder={
              (state.purchasePrice ?? state.askingPrice)
                ? String(state.purchasePrice ?? state.askingPrice)
                : undefined
            }
            onChange={(cpcvPrice) => update({ cpcvPrice })}
            locale={locale}
          />
          <NumberField
            label={t("deposit")}
            help={t("depositHelp")}
            kind="money"
            value={state.deposit}
            onChange={(deposit) => update({ deposit })}
            locale={locale}
          />
          <NumberField
            label={t("assignmentPrice")}
            help={t("assignmentPriceHelp")}
            kind="money"
            value={state.assignmentPrice}
            onChange={(assignmentPrice) => update({ assignmentPrice })}
            locale={locale}
          />
          <NumberField
            label={t("assignmentMonths")}
            kind="number"
            value={state.assignmentMonths}
            onChange={(v) => update({ assignmentMonths: Math.max(1, Math.round(v ?? 1)) })}
            locale={locale}
          />
        </div>
        <SwitchField
          label={t("upfrontTransferTaxes")}
          help={t("upfrontTransferTaxesHelp")}
          checked={state.upfrontTransferTaxes}
          onChange={(upfrontTransferTaxes) => update({ upfrontTransferTaxes })}
        />
      </fieldset>
    </Section>
  );
}
