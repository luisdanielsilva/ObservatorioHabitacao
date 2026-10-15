"use client";

import type { ParameterSet, ScenarioKind, Seasonal } from "@olhovivo/engine";
import { ArrowLeft, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/HelpTip";
import { buysProperty, detailsPanels, type DetailsPanel } from "@/lib/calculator/flow";
import { permanentRentalYears, type MissingField } from "@/lib/calculator/run";
import {
  DEFAULT_LOAN_TERM_YEARS,
  MAX_LOAN_TERM_YEARS,
  RECOMMENDED_LOAN_TERM_YEARS,
  type CalculatorState,
} from "@/lib/calculator/state";
import { englobamentoThreshold } from "@/lib/calculator/tax";
import type { Formatter } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { AssumptionsSection } from "./AssumptionsSection";
import type { Update } from "./Calculator";
import { SCENARIO_COLORS } from "./colors";
import {
  focusFirstInvalid,
  MissingAlert,
  NumberField,
  NumberInput,
  SelectField,
  SwitchField,
} from "./fields";

const SEASONS = ["high", "mid", "low"] as const;

export interface DetailsStepProps {
  deals: ScenarioKind[];
  state: CalculatorState;
  update: Update;
  /** Updates assumptions; tracks a manual IMI rate. */
  updateAssumptions: Update;
  reference: ReferenceResponse | null;
  loanAmount: number;
  purchasePrice: number | null;
  /** The active tax parameters (LTV limits, IRS brackets, rental tax). */
  params: ParameterSet | null;
  /** The latest published rent update coefficient. */
  rentUpdate: { value: number; date: string; source: string } | null;
  euribor12m: { value: number; date: string } | null;
  spread: number | null;
  nonResidentRule: boolean;
  /** Missing inputs per deal, from the calculation. */
  missing: (deal: ScenarioKind) => MissingField[];
  panel: number;
  onPanelChange: (panel: number) => void;
  onShowResults: () => void;
  locale: string;
}

/**
 * Step 3: the details, one panel at a time — first what the chosen deals share (purchase,
 * financing, taxes), then each deal's own inputs — and finally the results.
 */
export function DetailsStep(props: DetailsStepProps) {
  const { deals, missing, panel, onPanelChange, onShowResults } = props;
  const t = useTranslations("evaluate");
  const container = useRef<HTMLElement>(null);
  const [tried, setTried] = useState(false);
  const panels = detailsPanels(deals);
  const index = Math.min(panel, panels.length - 1);
  const current = panels[index]!;
  const currentMissing = current === "common" ? [] : missing(current);
  const last = index === panels.length - 1;
  const title = (p: DetailsPanel) =>
    p === "common" ? t(buysProperty(deals) ? "panelCommon" : "panelCommonCessao") : t(`deals.${p}`);

  const go = (to: number) => {
    setTried(false);
    onPanelChange(to);
  };

  return (
    <>
      {panels.length > 1 && (
        <nav aria-label={t("panelsLabel")}>
          <ol className="flex flex-wrap gap-2">
            {panels.map((p, i) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    i === index && "border-primary bg-primary/10 font-medium text-foreground",
                    i !== index && "text-muted-foreground",
                  )}
                >
                  {p !== "common" && (
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: SCENARIO_COLORS[p] }}
                    />
                  )}
                  {i + 1}. {title(p)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <section ref={container} aria-labelledby="details-panel-title" className="space-y-5">
        <h3 id="details-panel-title" className="font-semibold">
          {t("panelProgress", { current: index + 1, total: panels.length, name: title(current) })}
        </h3>
        {current === "common" ? (
          <CommonPanel {...props} />
        ) : (
          <DealPanel deal={current} invalid={tried ? currentMissing : []} {...props} />
        )}
      </section>

      {tried && currentMissing.length > 0 && (
        <MissingAlert>
          {t("missing", {
            fields: currentMissing.map((m) => t(`missingFields.${m}`)).join(", "),
          })}
        </MissingAlert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t("requiredNote")}</p>
        <div className="flex shrink-0 gap-2">
          {index > 0 && (
            <Button variant="outline" onClick={() => go(index - 1)}>
              <ArrowLeft />
              {t("back")}
            </Button>
          )}
          <Button
            onClick={() => {
              setTried(true);
              if (currentMissing.length > 0) return focusFirstInvalid(container.current);
              if (last) {
                // Every deal must be complete; open the first one that is not.
                const incomplete = panels.findIndex((p) => p !== "common" && missing(p).length);
                if (incomplete >= 0) go(incomplete);
                else onShowResults();
              } else {
                go(index + 1);
              }
            }}
          >
            {last ? t("showResults") : t("next")}
          </Button>
        </div>
      </div>
    </>
  );
}

function CommonPanel(props: DetailsStepProps) {
  const { deals, state, update, locale, nonResidentRule } = props;
  const t = useTranslations("evaluate");
  const f = useFormat();
  const buying = buysProperty(deals);

  return (
    <>
      {buying && (
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
            <div />
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
      )}

      <PropertyUse {...props} />

      {buying && <Financing {...props} />}

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t("taxes")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("otherTaxableIncome")}
            help={t("otherTaxableIncomeHelp")}
            kind="money"
            value={state.otherTaxableIncome}
            placeholder="0"
            hint={
              props.params &&
              t("irsBracketsHint", {
                year: props.params.year,
                min: f.percent(props.params.irs.brackets[0]!.rate, 1),
                max: f.percent(props.params.irs.brackets.at(-1)!.rate, 0),
              })
            }
            onChange={(otherTaxableIncome) => update({ otherTaxableIncome })}
            locale={locale}
          />
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

      <AssumptionsSection
        scope="common"
        deals={deals}
        state={state}
        update={props.updateAssumptions}
        rentUpdate={props.rentUpdate}
        locale={locale}
      />
    </>
  );
}

/**
 * The property use sets the IMT table and how much banks may lend (Banco de Portugal: 90 % for
 * an own permanent home, 80 % otherwise). Changing it resets the loan to that maximum.
 */
function PropertyUse({ state, update, params }: DetailsStepProps) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const maxLtv = params?.financing.maxLtv;
  const ltv = maxLtv ? (state.propertyUse === "hpp" ? maxLtv.hpp : maxLtv.other) : null;

  return (
    <div className="space-y-2">
      <SelectField
        label={t("propertyUse")}
        value={state.propertyUse}
        options={(["secondary", "hpp"] as const).map((v) => ({
          value: v,
          label: t(`uses.${v}`),
        }))}
        onChange={(propertyUse) => update({ propertyUse, loanAmount: null })}
      />
      {ltv !== null && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("ltvInfo", { ltv: f.percent(ltv, 0), down: f.percent(1 - ltv, 0) })}
        </p>
      )}
    </div>
  );
}

function Financing({
  state,
  update,
  loanAmount,
  purchasePrice,
  params,
  euribor12m,
  spread,
  locale,
}: DetailsStepProps) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const maxLtv = params?.financing.maxLtv;
  const ltv = maxLtv ? (state.propertyUse === "hpp" ? maxLtv.hpp : maxLtv.other) : null;
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
                ? `${f.percent(loanAmount / purchasePrice, 0)} LTV${ltv !== null ? ` · ${t("ltvMax", { ltv: f.percent(ltv, 0) })}` : ""}`
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
            help={t("loanTermHelp", {
              recommended: RECOMMENDED_LOAN_TERM_YEARS,
              max: MAX_LOAN_TERM_YEARS,
            })}
            hint={
              state.loanTermYears > RECOMMENDED_LOAN_TERM_YEARS
                ? t("loanTermAboveRecommended", { recommended: RECOMMENDED_LOAN_TERM_YEARS })
                : undefined
            }
            onChange={(v) =>
              update({
                loanTermYears: Math.min(
                  MAX_LOAN_TERM_YEARS,
                  Math.max(1, Math.round(v ?? DEFAULT_LOAN_TERM_YEARS)),
                ),
              })
            }
            locale={locale}
          />
        </div>
      )}
    </fieldset>
  );
}

function DealPanel({
  deal,
  invalid,
  ...props
}: DetailsStepProps & { deal: ScenarioKind; invalid: MissingField[] }) {
  const { state, update, locale } = props;
  const missingValue = (field: MissingField, value: number | null) =>
    invalid.includes(field) && !(value !== null && value > 0);
  const t = useTranslations("evaluate");
  const f = useFormat();

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
      invalid={required && missingValue("marketValue", state.marketValue)}
      value={state.marketValue}
      onChange={(marketValue) => update({ marketValue })}
      hint={saleHint}
      locale={locale}
    />
  );
  // The agency's commission on the sale, shown in euros with VAT at the price entered.
  const vat = 1 + (props.params?.vatRate ?? 0.23);
  const commission = (
    key: "sellingCommissionRate" | "assignmentCommissionRate",
    base: number | null,
  ) => (
    <NumberField
      label={t(key === "sellingCommissionRate" ? "sellingCommission" : "assignmentCommission")}
      help={t(
        key === "sellingCommissionRate" ? "sellingCommissionHelp" : "assignmentCommissionHelp",
      )}
      kind="percent"
      value={state[key]}
      onChange={(v) => update({ [key]: Math.max(0, v ?? 0) })}
      hint={
        base && base > 0 && state[key] > 0
          ? t("commissionHint", {
              amount: f.euro(base * state[key] * vat),
              price: f.euro(base),
            })
          : undefined
      }
      locale={locale}
    />
  );
  const holdingYears = (
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

  return (
    <>
      <p className="text-sm text-muted-foreground">{t(`dealIntro.${deal}`)}</p>

      {deal === "flip" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("resaleValue")}
            help={t("resaleValueHelp")}
            kind="money"
            required
            invalid={missingValue("resaleValue", state.resaleValue)}
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
          {commission("sellingCommissionRate", state.resaleValue)}
          {marketValue(false)}
        </div>
      )}

      {deal === "longTermRental" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t("monthlyRent")}
              help={t("monthlyRentHelp")}
              kind="money"
              required
              invalid={missingValue("monthlyRent", state.monthlyRent)}
              value={state.monthlyRent}
              onChange={(monthlyRent) => update({ monthlyRent })}
              hint={rentHint}
              locale={locale}
            />
            <NumberField
              label={t("contractYears")}
              help={t("contractYearsHelp")}
              kind="number"
              suffix={t("yearsShort")}
              value={state.contractYears}
              onChange={(v) => update({ contractYears: Math.max(1, Math.round(v ?? 1)) })}
              locale={locale}
            />
            {marketValue(false)}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("permanentRentalNote", { years: permanentRentalYears(state) })}
          </p>
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t("taxes")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t("rentalTaxMode")}
                value={state.rentalTaxMode}
                options={[
                  { value: "autonomous", label: t("rentalTaxAutonomous") },
                  { value: "marginal", label: t("rentalTaxMarginal") },
                ]}
                onChange={(rentalTaxMode) => update({ rentalTaxMode })}
              />
              <EnglobamentoNote params={props.params} />
            </div>
          </fieldset>
        </>
      )}

      {deal === "shortTermRental" && (
        <>
          <SeasonTable
            state={state}
            update={update}
            locale={locale}
            invalid={invalid.includes("nightly")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {marketValue(true)}
            {holdingYears}
            {commission("sellingCommissionRate", state.marketValue)}
          </div>
        </>
      )}

      {deal === "contractAssignment" && (
        <>
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
              invalid={missingValue("cessao", state.deposit)}
              value={state.deposit}
              onChange={(deposit) => update({ deposit })}
              locale={locale}
            />
            <NumberField
              label={t("assignmentPrice")}
              help={t("assignmentPriceHelp")}
              kind="money"
              required
              invalid={missingValue("cessao", state.assignmentPrice)}
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
            {commission(
              "assignmentCommissionRate",
              state.assignmentPrice !== null && state.deposit !== null
                ? state.assignmentPrice - state.deposit
                : null,
            )}
            {marketValue(true)}
          </div>
          <SwitchField
            label={t("upfrontTransferTaxes")}
            help={t("upfrontTransferTaxesHelp")}
            checked={state.upfrontTransferTaxes}
            onChange={(upfrontTransferTaxes) => update({ upfrontTransferTaxes })}
          />
        </>
      )}

      <AssumptionsSection
        scope={deal}
        deals={props.deals}
        state={state}
        update={props.updateAssumptions}
        rentUpdate={props.rentUpdate}
        locale={locale}
      />
    </>
  );
}

/**
 * When adding rents to other income can cost less than the flat rate (CIRS art. 72 n.º 13).
 * Information only; the calculation uses the option the user picks.
 */
function EnglobamentoNote({ params }: { params: ParameterSet | null }) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const threshold = params && englobamentoThreshold(params);
  if (!threshold) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-2">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      {t("englobamentoNote", {
        income: f.euro(threshold.income),
        marginal: f.percent(threshold.marginalRate, 1),
        flat: f.percent(threshold.flatRate, 0),
      })}
    </p>
  );
}

function SeasonTable({
  state,
  update,
  locale,
  invalid,
}: {
  state: CalculatorState;
  update: Update;
  locale: string;
  /** Marks the empty season inputs. */
  invalid: boolean;
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
                    invalid={invalid && state.nightlyRate[season] === null}
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
                    invalid={invalid && state.occupancy[season] === null}
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

type SummaryKey =
  "purchase" | "resale" | "rent" | "nightly" | "deposit" | "assignment" | "loan" | "noLoan";

/** One line describing the main inputs, for the collapsed step. */
export function detailsSummary(
  deals: ScenarioKind[],
  state: CalculatorState,
  f: Formatter,
  t: (key: `summary.${SummaryKey}`, values?: { value: string }) => string,
): string {
  const price = state.purchasePrice ?? state.askingPrice;
  const parts: (string | false | null)[] = [];
  if (buysProperty(deals)) {
    parts.push(price !== null && t("summary.purchase", { value: f.euro(price) }));
    parts.push(state.useLoan ? t("summary.loan") : t("summary.noLoan"));
  }
  if (deals.includes("flip") && state.resaleValue !== null)
    parts.push(t("summary.resale", { value: f.euro(state.resaleValue) }));
  if (deals.includes("longTermRental") && state.monthlyRent !== null)
    parts.push(t("summary.rent", { value: f.euro(state.monthlyRent) }));
  if (deals.includes("shortTermRental") && state.nightlyRate.high !== null)
    parts.push(t("summary.nightly", { value: f.euro(state.nightlyRate.high) }));
  if (deals.includes("contractAssignment")) {
    if (state.deposit !== null) parts.push(t("summary.deposit", { value: f.euro(state.deposit) }));
    if (state.assignmentPrice !== null)
      parts.push(t("summary.assignment", { value: f.euro(state.assignmentPrice) }));
  }
  return parts.filter(Boolean).join(" · ");
}
