"use client";

import { useTranslations } from "next-intl";
import { NumberField, SwitchField } from "@/components/calculator/fields";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/useFormat";
import { MIN_PURCHASE_YEAR, type ValuationState } from "@/lib/valuation/state";
import type { UpdateValuation } from "./PropertyStep";

/**
 * Step 3 of Vender (optional): the sale and the purchase, for what the seller keeps after the
 * commission, the IRS on the gain and the loan. Skipping it shows the value only.
 */
export function SaleStep({
  state,
  update,
  likely,
  onContinue,
  onSkip,
  locale,
}: {
  state: ValuationState;
  update: UpdateValuation;
  /** The estimate's likely value, used when no sale price is entered. */
  likely: number | null;
  onContinue: () => void;
  onSkip: () => void;
  locale: string;
}) {
  const t = useTranslations("sell");
  const f = useFormat();
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("saleIntro")}</p>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t("saleGroup")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label={t("salePrice")}
            kind="money"
            value={state.salePrice}
            onChange={(salePrice) => update({ salePrice })}
            placeholder={likely !== null ? String(likely) : undefined}
            hint={likely !== null ? t("salePriceHint", { value: f.euro(likely) }) : undefined}
            locale={locale}
          />
          <NumberField
            label={t("commission")}
            help={t("commissionHelp")}
            kind="percent"
            value={state.sellingCommissionRate}
            onChange={(v) => update({ sellingCommissionRate: Math.min(v ?? 0, 1) })}
            locale={locale}
          />
          <NumberField
            label={t("otherSaleCosts")}
            help={t("otherSaleCostsHelp")}
            kind="money"
            value={state.otherSaleCosts}
            onChange={(otherSaleCosts) => update({ otherSaleCosts })}
            locale={locale}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t("purchaseGroup")}</legend>
        <p className="text-xs text-muted-foreground">{t("purchaseGroupHelp")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("purchasePrice")}
            help={t("purchasePriceHelp")}
            kind="money"
            value={state.purchasePrice}
            onChange={(purchasePrice) => update({ purchasePrice })}
            locale={locale}
          />
          <NumberField
            label={t("purchaseYear")}
            help={t("purchaseYearHelp")}
            kind="number"
            min={MIN_PURCHASE_YEAR}
            value={state.purchaseYear}
            onChange={(v) =>
              update({
                purchaseYear:
                  v !== null && Number.isInteger(v) && v >= MIN_PURCHASE_YEAR && v <= year
                    ? v
                    : null,
              })
            }
            locale={locale}
          />
          <NumberField
            label={t("purchaseCosts")}
            help={t("purchaseCostsHelp")}
            kind="money"
            value={state.purchaseCosts}
            onChange={(purchaseCosts) => update({ purchaseCosts })}
            locale={locale}
          />
          <NumberField
            label={t("works")}
            help={t("worksHelp")}
            kind="money"
            value={state.works}
            onChange={(works) => update({ works })}
            locale={locale}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t("homeGroup")}</legend>
        <SwitchField
          label={t("ownHome")}
          help={t("ownHomeHelp")}
          checked={state.ownHome}
          onChange={(ownHome) => update({ ownHome })}
        />
        {state.ownHome && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t("reinvestment")}
              help={t("reinvestmentHelp")}
              kind="money"
              value={state.reinvestment}
              onChange={(reinvestment) => update({ reinvestment })}
              locale={locale}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t("loanGroup")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("loanBalance")}
            help={t("loanBalanceHelp")}
            kind="money"
            value={state.loanBalance}
            onChange={(loanBalance) => update({ loanBalance })}
            locale={locale}
          />
          <NumberField
            label={t("earlyRepayment")}
            help={t("earlyRepaymentHelp")}
            kind="percent"
            value={state.earlyRepaymentRate}
            onChange={(v) => update({ earlyRepaymentRate: Math.min(v ?? 0, 1) })}
            locale={locale}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t("irsGroup")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("otherIncome")}
            help={t("otherIncomeHelp")}
            kind="money"
            value={state.otherTaxableIncome}
            onChange={(otherTaxableIncome) => update({ otherTaxableIncome })}
            locale={locale}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onSkip}>
          {t("skipSale")}
        </Button>
        <Button onClick={onContinue}>{t("showResult")}</Button>
      </div>
    </div>
  );
}
