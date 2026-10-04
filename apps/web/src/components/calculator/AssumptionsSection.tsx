"use client";

import { ChevronDown } from "lucide-react";
import type { ScenarioKind } from "@olhovivo/engine";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CalculatorState } from "@/lib/calculator/state";
import { cn } from "@/lib/utils";
import type { Update } from "./Calculator";
import { NumberField, SwitchField } from "./fields";

type NumericKey = {
  [K in keyof CalculatorState]: CalculatorState[K] extends number | null ? K : never;
}[keyof CalculatorState];

/** Default values behind the calculation, limited to those the chosen deal uses. */
export function AssumptionsSection({
  deal,
  state,
  update,
  locale,
}: {
  deal: ScenarioKind;
  state: CalculatorState;
  update: Update;
  locale: string;
}) {
  const t = useTranslations("evaluate");
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

  const buying = deal !== "contractAssignment";
  const groups: { title: string; fields: (React.ReactNode | false)[] }[] = [
    {
      title: t("assumptionsProperty"),
      fields: [
        buying && field("imiRate", t("imiRate"), "percent"),
        field("vpt", t("vpt"), "money", { help: t("vptHelp"), nullable: true }),
        buying && field("condominiumMonthly", t("condominium"), "money"),
        buying && field("insuranceAnnual", t("insurance"), "money"),
        deal === "flip" && field("utilitiesMonthly", t("utilities"), "money"),
        buying && field("sellingCommissionRate", t("sellingCommission"), "percent"),
        field("appreciationRate", t("appreciation"), "percent", {
          help: t(deal === "contractAssignment" ? "appreciationHelpCessao" : "appreciationHelp"),
        }),
      ],
    },
  ];
  if (deal === "longTermRental") {
    groups.push({
      title: t("scenarioLongTerm"),
      fields: [
        field("rentGrowthRate", t("rentGrowth"), "percent"),
        field("vacancyRate", t("vacancy"), "percent", { help: t("vacancyHelp") }),
        field("maintenanceRate", t("maintenance"), "percent"),
        field("managementRate", t("management"), "percent"),
      ],
    });
  }
  if (deal === "shortTermRental") {
    groups.push({
      title: t("scenarioShortTerm"),
      fields: [
        field("rentGrowthRate", t("nightlyGrowth"), "percent"),
        field("alPlatformFeeRate", t("alPlatformFee"), "percent"),
        field("alManagementRate", t("alManagement"), "percent"),
        field("averageStayNights", t("averageStay"), "number"),
        field("cleaningFeePerStay", t("cleaningFee"), "money"),
        field("cleaningCostPerStay", t("cleaningCost"), "money"),
        field("consumablesPerNight", t("consumables"), "money"),
        field("alUtilitiesMonthly", t("utilities"), "money"),
        field("furnishingCost", t("furnishing"), "money"),
        field("alRegistrationCost", t("alRegistration"), "money"),
      ],
    });
  }
  if (deal === "contractAssignment") {
    groups.push({
      title: t("cessaoTitle"),
      fields: [
        field("assignmentCommissionRate", t("assignmentCommission"), "percent"),
        field("assignmentOtherCosts", t("assignmentOtherCosts"), "money"),
      ],
    });
  }

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
        {deal === "shortTermRental" && (
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
