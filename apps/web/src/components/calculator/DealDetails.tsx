"use client";

import type { ScenarioKind, Seasonal } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/HelpTip";
import type { MissingField } from "@/lib/calculator/run";
import type { CalculatorState } from "@/lib/calculator/state";
import type { Formatter } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { AssumptionsSection } from "./AssumptionsSection";
import type { Update } from "./Calculator";
import { NumberField, NumberInput, SelectField, SwitchField } from "./fields";

const SEASONS = ["high", "mid", "low"] as const;

export interface DealDetailsProps {
  deal: ScenarioKind;
  state: CalculatorState;
  update: Update;
  /** Updates assumptions; tracks a manual IMI rate. */
  updateAssumptions: Update;
  reference: ReferenceResponse | null;
  loanAmount: number;
  purchasePrice: number | null;
  euribor12m: { value: number; date: string } | null;
  spread: number | null;
  nonResidentRule: boolean;
  missing: MissingField[];
  onShowResults: () => void;
  locale: string;
}

/** Step 3: the inputs the chosen deal needs, then financing, taxes and assumptions. */
export function DealDetails(props: DealDetailsProps) {
  const { deal, state, update, missing, onShowResults, locale } = props;
  const t = useTranslations("evaluate");
  const f = useFormat();
  const [tried, setTried] = useState(false);

  // Reference hints: what the INE medians imply for this property's area.
  const m2 = state.areaM2;
  const saleHint =
    props.reference?.sale && m2
      ? `≈ ${f.euro(props.reference.sale.value * m2)} (INE × ${f.number(m2)} m²)`
      : undefined;
  const rentHint =
    props.reference?.rent && m2
      ? `≈ ${f.euro(props.reference.rent.value * m2)} (INE × ${f.number(m2)} m²)`
      : undefined;

  const marketValue = (required: boolean) => (
    <NumberField
      label={t("marketValue")}
      help={t("marketValueHelp")}
      kind="money"
      required={required}
      value={state.marketValue}
      onChange={(marketValue) => update({ marketValue })}
      hint={saleHint}
      locale={locale}
    />
  );

  return (
    <>
      <p className="text-sm text-muted-foreground">{t(`dealIntro.${deal}`)}</p>

      {deal === "contractAssignment" ? (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">{t("cessaoTitle")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t("cpcvPrice")}
              help={t("cpcvPriceHelp")}
              kind="money"
              value={state.cpcvPrice}
              placeholder={state.askingPrice ? String(state.askingPrice) : undefined}
              hint={t("defaultsToAsking")}
              onChange={(cpcvPrice) => update({ cpcvPrice })}
              locale={locale}
            />
            <NumberField
              label={t("deposit")}
              help={t("depositHelp")}
              kind="money"
              required
              value={state.deposit}
              onChange={(deposit) => update({ deposit })}
              locale={locale}
            />
            <NumberField
              label={t("assignmentPrice")}
              help={t("assignmentPriceHelp")}
              kind="money"
              required
              value={state.assignmentPrice}
              onChange={(assignmentPrice) => update({ assignmentPrice })}
              locale={locale}
            />
            <NumberField
              label={t("assignmentMonths")}
              kind="number"
              suffix={t("monthsShort")}
              value={state.assignmentMonths}
              onChange={(v) => update({ assignmentMonths: Math.max(1, Math.round(v ?? 1)) })}
              locale={locale}
            />
            {marketValue(true)}
          </div>
          <SwitchField
            label={t("upfrontTransferTaxes")}
            help={t("upfrontTransferTaxesHelp")}
            checked={state.upfrontTransferTaxes}
            onChange={(upfrontTransferTaxes) => update({ upfrontTransferTaxes })}
          />
        </fieldset>
      ) : (
        <>
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t("purchase")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label={t("purchasePrice")}
                help={t("purchasePriceHelp")}
                kind="money"
                value={state.purchasePrice}
                placeholder={state.askingPrice ? String(state.askingPrice) : undefined}
                onChange={(purchasePrice) => update({ purchasePrice })}
                locale={locale}
              />
              <SelectField
                label={t("propertyUse")}
                value={state.propertyUse}
                options={(["secondary", "hpp"] as const).map((v) => ({
                  value: v,
                  label: t(`uses.${v}`),
                }))}
                onChange={(propertyUse) => update({ propertyUse })}
              />
              <NumberField
                label={t("renovationBudget")}
                kind="money"
                value={state.renovationBudget}
                onChange={(v) => update({ renovationBudget: v ?? 0 })}
                locale={locale}
              />
              <NumberField
                label={t("renovationMonths")}
                kind="number"
                suffix={t("monthsShort")}
                value={state.renovationMonths}
                onChange={(v) => update({ renovationMonths: Math.round(v ?? 0) })}
                locale={locale}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t(`dealValues.${deal}`)}</legend>
            {deal === "flip" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label={t("resaleValue")}
                  help={t("resaleValueHelp")}
                  kind="money"
                  required
                  value={state.resaleValue}
                  onChange={(resaleValue) => update({ resaleValue })}
                  hint={saleHint}
                  locale={locale}
                />
                <NumberField
                  label={t("flipMonths")}
                  kind="number"
                  suffix={t("monthsShort")}
                  value={state.flipMonths}
                  onChange={(v) => update({ flipMonths: Math.max(1, Math.round(v ?? 12)) })}
                  locale={locale}
                />
                {marketValue(false)}
              </div>
            )}
            {deal === "longTermRental" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label={t("monthlyRent")}
                  help={t("monthlyRentHelp")}
                  kind="money"
                  required
                  value={state.monthlyRent}
                  onChange={(monthlyRent) => update({ monthlyRent })}
                  hint={rentHint}
                  locale={locale}
                />
                {marketValue(true)}
                <RentalYears {...props} />
              </div>
            )}
            {deal === "shortTermRental" && (
              <>
                <SeasonTable state={state} update={update} locale={locale} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {marketValue(true)}
                  <RentalYears {...props} />
                </div>
              </>
            )}
          </fieldset>

          <Financing {...props} />
        </>
      )}

      <Taxes {...props} />

      <AssumptionsSection
        deal={deal}
        state={state}
        update={props.updateAssumptions}
        locale={locale}
      />

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {tried && missing.length > 0
            ? t("missing", { fields: missing.map((m) => t(`missingFields.${m}`)).join(", ") })
            : t("requiredNote")}
        </p>
        <Button
          onClick={() => {
            setTried(true);
            if (missing.length === 0) onShowResults();
          }}
          className="shrink-0"
        >
          {t("showResults")}
        </Button>
      </div>
    </>
  );
}

function RentalYears({ state, update, locale }: DealDetailsProps) {
  const t = useTranslations("evaluate");
  return (
    <NumberField
      label={t("holdingYears")}
      help={t("holdingYearsHelp")}
      kind="number"
      suffix={t("yearsShort")}
      value={state.rentalYears}
      onChange={(v) => update({ rentalYears: Math.max(1, Math.min(40, Math.round(v ?? 10))) })}
      locale={locale}
    />
  );
}

function SeasonTable({
  state,
  update,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const seasonLabel = { high: t("seasonHigh"), mid: t("seasonMid"), low: t("seasonLow") };
  const setSeason = (
    key: "nightlyRate" | "occupancy",
    season: keyof Seasonal<unknown>,
    value: number | null,
  ) => update({ [key]: { ...state[key], [season]: value } });

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1 text-sm">
        {t("nightlyRates")} / {t("occupancyRates")}
        <span aria-hidden className="text-destructive">
          *
        </span>
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
                <span className="sr-only">{t("season")}</span>
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
                    required
                    value={state.nightlyRate[season]}
                    onChange={(v) => setSeason("nightlyRate", season, v)}
                    locale={locale}
                    aria-label={`${t("nightlyRates")} — ${seasonLabel[season]}`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <NumberInput
                    kind="percent"
                    required
                    value={state.occupancy[season]}
                    onChange={(v) =>
                      setSeason("occupancy", season, v === null ? null : Math.min(1, v))
                    }
                    locale={locale}
                    aria-label={`${t("occupancyRates")} — ${seasonLabel[season]}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

function Financing({
  state,
  update,
  loanAmount,
  purchasePrice,
  euribor12m,
  spread,
  locale,
}: DealDetailsProps) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">{t("financing")}</legend>
      <SwitchField
        label={t("useLoan")}
        checked={state.useLoan}
        onChange={(useLoan) => update({ useLoan })}
      />
      {state.useLoan && (
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label={t("loanAmount")}
            help={t("loanAmountHelp")}
            kind="money"
            value={state.loanAmount}
            placeholder={loanAmount ? String(loanAmount) : undefined}
            hint={
              purchasePrice && loanAmount
                ? `${f.percent(loanAmount / purchasePrice, 0)} LTV`
                : undefined
            }
            onChange={(v) => update({ loanAmount: v })}
            locale={locale}
          />
          <NumberField
            label={t("interestRate")}
            help={
              euribor12m && spread !== null
                ? t("interestRateHelp", {
                    euribor: f.percent(euribor12m.value, 2),
                    spread: f.percent(spread, 2),
                  })
                : t("interestRateHelpNoEuribor")
            }
            kind="percent"
            value={state.interestRate}
            onChange={(v) => update({ interestRate: v ?? 0 })}
            locale={locale}
          />
          <NumberField
            label={t("loanTerm")}
            kind="number"
            suffix={t("yearsShort")}
            value={state.loanTermYears}
            onChange={(v) => update({ loanTermYears: Math.max(1, Math.round(v ?? 30)) })}
            locale={locale}
          />
        </div>
      )}
    </fieldset>
  );
}

function Taxes({ deal, state, update, nonResidentRule, locale }: DealDetailsProps) {
  const t = useTranslations("evaluate");
  const rental = deal === "longTermRental";
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">{t("taxes")}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {deal === "contractAssignment" && (
          <SelectField
            label={t("propertyUse")}
            value={state.propertyUse}
            options={(["secondary", "hpp"] as const).map((v) => ({
              value: v,
              label: t(`uses.${v}`),
            }))}
            onChange={(propertyUse) => update({ propertyUse })}
          />
        )}
        <NumberField
          label={t("marginalTaxRate")}
          help={t("marginalTaxRateHelp")}
          kind="percent"
          value={state.marginalTaxRate}
          onChange={(v) => update({ marginalTaxRate: Math.min(1, v ?? 0) })}
          locale={locale}
        />
        {rental && (
          <SelectField
            label={t("rentalTaxMode")}
            value={state.rentalTaxMode}
            options={[
              { value: "autonomous", label: t("rentalTaxAutonomous") },
              { value: "marginal", label: t("rentalTaxMarginal") },
            ]}
            onChange={(rentalTaxMode) => update({ rentalTaxMode })}
          />
        )}
        {rental && state.rentalTaxMode === "autonomous" && (
          <NumberField
            label={t("contractYears")}
            help={t("contractYearsHelp")}
            kind="number"
            suffix={t("yearsShort")}
            value={state.contractYears}
            onChange={(v) => update({ contractYears: Math.max(1, Math.round(v ?? 1)) })}
            locale={locale}
          />
        )}
        {nonResidentRule && (
          <div className="sm:col-span-2">
            <SwitchField
              label={t("buyerNonResident")}
              help={t("buyerNonResidentHelp")}
              checked={state.buyerNonResident}
              onChange={(buyerNonResident) => update({ buyerNonResident })}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}

/** One line describing the deal's main inputs, for the collapsed step. */
export function dealSummary(
  deal: ScenarioKind,
  state: CalculatorState,
  f: Formatter,
  t: (
    key: `summary.${"purchase" | "resale" | "rent" | "nightly" | "deposit" | "assignment" | "loan" | "noLoan"}`,
    values?: { value: string },
  ) => string,
): string {
  const price = state.purchasePrice ?? state.askingPrice;
  const parts: (string | false | null)[] = [];
  if (deal === "contractAssignment") {
    parts.push(
      state.deposit !== null && t("summary.deposit", { value: f.euro(state.deposit) }),
      state.assignmentPrice !== null &&
        t("summary.assignment", { value: f.euro(state.assignmentPrice) }),
    );
  } else {
    parts.push(price !== null && t("summary.purchase", { value: f.euro(price) }));
    if (deal === "flip" && state.resaleValue !== null)
      parts.push(t("summary.resale", { value: f.euro(state.resaleValue) }));
    if (deal === "longTermRental" && state.monthlyRent !== null)
      parts.push(t("summary.rent", { value: f.euro(state.monthlyRent) }));
    if (deal === "shortTermRental" && state.nightlyRate.high !== null)
      parts.push(t("summary.nightly", { value: f.euro(state.nightlyRate.high) }));
    parts.push(state.useLoan ? t("summary.loan") : t("summary.noLoan"));
  }
  return parts.filter(Boolean).join(" · ");
}
