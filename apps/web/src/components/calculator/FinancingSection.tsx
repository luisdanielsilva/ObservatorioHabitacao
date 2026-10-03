"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import type { Update } from "./Calculator";
import { NumberField, Section, SelectField, SwitchField } from "./fields";

export function FinancingSection({
  state,
  update,
  loanAmount,
  purchasePrice,
  euribor12m,
  spread,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  loanAmount: number;
  purchasePrice: number | null;
  euribor12m: { value: number; date: string } | null;
  spread: number | null;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const id = useId();

  return (
    <Section title={t("stepFinancing")} id={`${id}-financing`}>
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

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t("holding")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("flipMonths")}
            kind="number"
            suffix={t("monthsShort")}
            value={state.flipMonths}
            onChange={(v) => update({ flipMonths: Math.max(1, Math.round(v ?? 12)) })}
            locale={locale}
          />
          <NumberField
            label={t("rentalYears")}
            kind="number"
            suffix={t("yearsShort")}
            value={state.rentalYears}
            onChange={(v) =>
              update({ rentalYears: Math.max(1, Math.min(40, Math.round(v ?? 10))) })
            }
            locale={locale}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t("taxes")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("marginalTaxRate")}
            help={t("marginalTaxRateHelp")}
            kind="percent"
            value={state.marginalTaxRate}
            onChange={(v) => update({ marginalTaxRate: Math.min(1, v ?? 0) })}
            locale={locale}
          />
          <SelectField
            label={t("rentalTaxMode")}
            value={state.rentalTaxMode}
            options={[
              { value: "autonomous", label: t("rentalTaxAutonomous") },
              { value: "marginal", label: t("rentalTaxMarginal") },
            ]}
            onChange={(rentalTaxMode) => update({ rentalTaxMode })}
          />
          {state.rentalTaxMode === "autonomous" && (
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
        </div>
      </fieldset>
    </Section>
  );
}
