"use client";

import { ChevronDown } from "lucide-react";
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

export function AssumptionsSection({
  state,
  update,
  locale,
}: {
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

  const groups: { title: string; fields: React.ReactNode[] }[] = [
    {
      title: t("stepProperty"),
      fields: [
        field("imiRate", t("imiRate"), "percent"),
        field("vpt", t("vpt"), "money", { help: t("vptHelp"), nullable: true }),
        field("condominiumMonthly", t("condominium"), "money"),
        field("insuranceAnnual", t("insurance"), "money"),
        field("utilitiesMonthly", t("utilities"), "money"),
        field("sellingCommissionRate", t("sellingCommission"), "percent"),
        field("appreciationRate", t("appreciation"), "percent", { help: t("appreciationHelp") }),
      ],
    },
    {
      title: t("scenarioLongTerm"),
      fields: [
        field("rentGrowthRate", t("rentGrowth"), "percent"),
        field("vacancyRate", t("vacancy"), "percent", { help: t("vacancyHelp") }),
        field("maintenanceRate", t("maintenance"), "percent"),
        field("managementRate", t("management"), "percent"),
      ],
    },
    {
      title: t("scenarioShortTerm"),
      fields: [
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
    },
    {
      title: t("cessaoTitle"),
      fields: [
        field("assignmentCommissionRate", t("assignmentCommission"), "percent"),
        field("assignmentOtherCosts", t("assignmentOtherCosts"), "money"),
      ],
    },
  ];

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {t("assumptions")}
          </h2>
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
        <SwitchField
          label={t("vatRegistered")}
          checked={state.vatRegistered}
          onChange={(vatRegistered) => update({ vatRegistered })}
        />
      </div>
    </section>
  );
}
