"use client";

import { ChevronDown } from "lucide-react";
import type { ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import type { Update } from "./Calculator";
import { NumberField, SwitchField } from "./fields";

type NumericKey = {
  [K in keyof CalculatorState]: CalculatorState[K] extends number | null ? K : never;
}[keyof CalculatorState];

/**
 * Default values behind the calculation: those the chosen deals share (`scope` "common"), or
 * those of one deal.
 */
export function AssumptionsSection({
  scope,
  deals,
  state,
  update,
  rentUpdate,
  locale,
}: {
  scope: "common" | ScenarioKind;
  /** The chosen deals. */
  deals: ScenarioKind[];
  state: CalculatorState;
  update: Update;
  /** The latest published rent update coefficient, the default yearly rent increase. */
  rentUpdate: { value: number; date: string; source: string } | null;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const f = useFormat();
  const buying = deals.some((d) => d !== "contractAssignment");
  const id = useId();
  const [open, setOpen] = useState(false);

  const field = (
    key: NumericKey,
    label: string,
    kind: "money" | "percent" | "number",
    options: { help?: string; suffix?: string; nullable?: boolean } = {},
  ) => (
    <NumberField
      key={key}
      label={label}
      help={options.help}
      kind={kind}
      suffix={options.suffix}
      value={state[key]}
      onChange={(v) => update({ [key]: options.nullable ? v : (v ?? 0) })}
      locale={locale}
    />
  );

  const groups: { title: string; fields: (React.ReactNode | false)[] }[] = [];
  if (scope === "common") {
    groups.push({
      title: t("assumptionsProperty"),
      fields: [
        buying && field("imiRate", t("imiRate"), "percent"),
        field("vpt", t("vpt"), "money", { help: t("vptHelp"), nullable: true }),
      ],
    });
    if (buying && state.useLoan) {
      groups.push({
        title: t("loanFees"),
        fields: [
          field("valuationFee", t("valuationFee"), "money", { help: t("loanFeesHelp") }),
          field("processingFee", t("processingFee"), "money", { help: t("loanFeesHelp") }),
        ],
      });
    }
  }
  if (scope === "flip") {
    groups.push({
      title: t("deals.flip"),
      fields: [
        field("condominiumMonthly", t("condominium"), "money"),
        field("insuranceAnnual", t("insurance"), "money"),
      ],
    });
  }
  if (scope === "longTermRental") {
    groups.push({
      title: t("scenarioLongTerm"),
      fields: [
        field("rentGrowthRate", t("rentGrowth"), "percent", {
          help: rentUpdate
            ? t("rentGrowthHelp", {
                year: rentUpdate.date.slice(0, 4),
                rate: f.percent(rentUpdate.value, 2),
                source: rentUpdate.source,
              })
            : t("rentGrowthHelpNoSource"),
        }),
        field("vacancyMonths", t("vacancy"), "number", {
          help: t("vacancyHelp"),
          suffix: t("monthsShort"),
        }),
        field("maintenanceRate", t("maintenance"), "percent"),
        field("managementRate", t("management"), "percent"),
        field("rentalCondominiumMonthly", t("condominium"), "money"),
        field("rentalInsuranceMonthly", t("insuranceMonthly"), "money"),
      ],
    });
  }
  if (scope === "shortTermRental") {
    groups.push({
      title: t("scenarioShortTerm"),
      fields: [
        field("nightlyGrowthRate", t("nightlyGrowth"), "percent"),
        field("alPlatformFeeRate", t("alPlatformFee"), "percent"),
        field("alManagementRate", t("alManagement"), "percent"),
        field("alMaintenanceRate", t("alMaintenance"), "percent"),
        field("averageStayNights", t("averageStay"), "number"),
        field("cleaningFeePerStay", t("cleaningFee"), "money"),
        field("cleaningCostPerStay", t("cleaningCost"), "money"),
        field("consumablesPerNight", t("consumables"), "money"),
        field("alUtilitiesMonthly", t("utilities"), "money"),
        field("alCondominiumMonthly", t("condominium"), "money"),
        field("alInsuranceAnnual", t("insurance"), "money"),
        field("furnishingCost", t("furnishing"), "money"),
        field("alRegistrationCost", t("alRegistration"), "money"),
      ],
    });
  }
  if (scope === "contractAssignment") {
    groups.push({
      title: t("cessaoTitle"),
      fields: [field("assignmentOtherCosts", t("assignmentOtherCosts"), "money")],
    });
  }

  if (groups.every((g) => g.fields.every((x) => !x))) return null;

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 id={`${id}-title`} className="font-semibold">
            {t("assumptions")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("assumptionsHelp")}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t("hideAssumptions") : t("showAssumptions")}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      <div id={`${id}-body`} hidden={!open} className="mt-5 space-y-6">
        {groups.map((g) => (
          <fieldset key={g.title} className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground">{g.title}</legend>
            <div className="grid gap-4 sm:grid-cols-2">{g.fields}</div>
          </fieldset>
        ))}
        {scope === "shortTermRental" && (
          <SwitchField
            label={t("vatRegistered")}
            checked={state.vatRegistered}
            onChange={(vatRegistered) => update({ vatRegistered })}
          />
        )}
      </div>
    </section>
  );
}
