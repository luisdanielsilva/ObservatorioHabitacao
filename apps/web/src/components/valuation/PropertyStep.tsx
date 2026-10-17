"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { AreaPicker, type AreaTree } from "@/components/shared/AreaPicker";
import { FloorField } from "@/components/calculator/ComparablesSection";
import { FEATURE_LABEL } from "@/lib/calculator/labels";
import {
  focusFirstInvalid,
  MissingAlert,
  NumberField,
  SelectField,
} from "@/components/calculator/fields";
import { MapsLinkField } from "@/components/calculator/ListingStep";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { hasTypology } from "@/lib/calculator/flow";
import { CONDITIONS, FEATURES } from "@/lib/calculator/state";
import type { ValuationField } from "@/lib/valuation/flow";
import { VALUED_TYPES } from "@/lib/valuation/flow";
import { MISSING_FEATURE } from "@/lib/valuation/model";
import type { ValuationState } from "@/lib/valuation/state";

export type UpdateValuation = (patch: Partial<ValuationState>) => void;

/** Step 1 of Vender: where the property is and what it is like. */
export function PropertyStep({
  state,
  update,
  tree,
  missing,
  onContinue,
  locale,
}: {
  state: ValuationState;
  update: UpdateValuation;
  tree: AreaTree;
  missing: ValuationField[];
  onContinue: () => void;
  locale: string;
}) {
  const t = useTranslations("sell");
  const te = useTranslations("evaluate");
  const tc = useTranslations("comparables");
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [tried, setTried] = useState(false);
  const invalid = (field: ValuationField) => tried && missing.includes(field);
  // Only the features that matter for this type (a house has no lift).
  const features = FEATURES.filter((k) => MISSING_FEATURE[k].types.includes(state.propertyType));

  return (
    <div ref={container} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {t("location")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </legend>
        <AreaPicker
          tree={tree}
          value={state.areaId}
          onChange={(areaId) => update({ areaId })}
          invalid={invalid("areaId")}
        />
        <p className="text-xs text-muted-foreground">{t("locationHelp")}</p>
        <MapsLinkField value={state.mapsUrl} onChange={(mapsUrl) => update({ mapsUrl })} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={te("propertyType")}
          value={state.propertyType}
          options={VALUED_TYPES.map((v) => ({ value: v, label: te(`types.${v}`) }))}
          onChange={(propertyType) => update({ propertyType })}
        />
        {hasTypology(state.propertyType) && (
          <SelectField
            label={te("typology")}
            required
            invalid={invalid("bedrooms")}
            value={state.bedrooms ?? -1}
            options={[
              { value: -1, label: te("selectPlaceholder") },
              ...[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "T5+" : `T${n}` })),
            ]}
            onChange={(n) => update({ bedrooms: n < 0 ? null : n })}
          />
        )}
        <NumberField
          label={te("areaM2")}
          help={t("areaHelp")}
          kind="number"
          suffix="m²"
          required
          invalid={invalid("areaM2")}
          value={state.areaM2}
          onChange={(areaM2) => update({ areaM2 })}
          locale={locale}
        />
        <SelectField
          label={te("condition")}
          help={t("conditionHelp")}
          value={state.condition}
          options={CONDITIONS.map((v) => ({ value: v, label: te(`conditions.${v}`) }))}
          onChange={(condition) => update({ condition })}
        />
        {state.propertyType === "apartamento" && (
          <FloorField
            value={state.floor}
            onChange={(floor) => update({ floor })}
            unknownLabel={te("selectPlaceholder")}
            required
            invalid={invalid("floor")}
          />
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("features")}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {features.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${key}`}
                checked={state.features[key]}
                onCheckedChange={(c) =>
                  update({ features: { ...state.features, [key]: c === true } })
                }
              />
              <Label htmlFor={`${id}-${key}`} className="font-normal">
                {te(FEATURE_LABEL[key])}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("featuresHelp")}</p>
      </fieldset>

      {tried && missing.length > 0 && (
        <MissingAlert>
          {te("missing", {
            fields: missing
              .map((m) => (m === "floor" ? tc("floor") : t(`required.${m}`)))
              .join(", "),
          })}
        </MissingAlert>
      )}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{te("requiredNote")}</p>
        <Button
          onClick={() => {
            setTried(true);
            if (missing.length === 0) onContinue();
            else focusFirstInvalid(container.current);
          }}
          className="shrink-0"
        >
          {te("continue")}
        </Button>
      </div>
    </div>
  );
}
