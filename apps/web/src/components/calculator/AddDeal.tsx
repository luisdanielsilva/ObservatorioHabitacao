"use client";

import type { ParameterSet, ScenarioKind } from "@observatorio-habitacao/engine";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { needsPurchaseFields } from "@/lib/calculator/flow";
import { runCalculator, SCENARIO_KINDS, type CalculatorOutput } from "@/lib/calculator/run";
import { normaliseDeals, type CalculatorState } from "@/lib/calculator/state";
import { cn } from "@/lib/utils";
import { SCENARIO_COLORS } from "./colors";
import { NewDealFields, type FieldsProps } from "./DealDetails";
import { focusFirstInvalid, MissingAlert } from "./fields";
import { Results } from "./Results";

/**
 * In the results: another strategy, filled in and added without going back to the details
 * (issue #11), and the four strategies side by side. The new deal's fields edit a copy of the
 * evaluation, so the results shown do not move while typing and cancelling changes nothing.
 */
export function AddDeal({
  deals,
  state,
  output,
  params,
  startMonth,
  fields,
  onAdd,
}: {
  deals: ScenarioKind[];
  state: CalculatorState;
  output: CalculatorOutput | null;
  params: ParameterSet | null;
  startMonth: number;
  /** What the fields need besides the evaluation. */
  fields: Pick<
    FieldsProps,
    "reference" | "rentUpdate" | "euribor12m" | "spread" | "nonResidentRule" | "locale"
  >;
  /** Adds the deal with the values entered for it. */
  onAdd: (kind: ScenarioKind, patch: Partial<CalculatorState>) => void;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const form = useRef<HTMLElement>(null);
  const [adding, setAdding] = useState<ScenarioKind | null>(null);
  const [patch, setPatch] = useState<Partial<CalculatorState>>({});
  const [tried, setTried] = useState(false);
  const [comparing, setComparing] = useState(false);

  const draft = useMemo(
    () => ({
      ...state,
      ...patch,
      deals: adding ? normaliseDeals([...deals, adding]) : deals,
    }),
    [state, patch, deals, adding],
  );
  const draftOutput = useMemo(() => {
    if (!adding || !params) return null;
    try {
      return runCalculator(draft, params, startMonth);
    } catch {
      return null;
    }
  }, [adding, draft, params, startMonth]);

  // The form opens in view.
  useEffect(() => {
    if (adding) form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [adding]);

  const remaining = SCENARIO_KINDS.filter((k) => !deals.includes(k));
  if (remaining.length === 0) return null;

  const missing = adding
    ? (draftOutput?.outcomes.find((o) => o.kind === adding)?.missing ?? [])
    : [];
  const open = (kind: ScenarioKind) => {
    setAdding(kind);
    setPatch({});
    setTried(false);
  };
  const close = () => {
    setAdding(null);
    setPatch({});
    setTried(false);
  };
  const change = (p: Partial<CalculatorState>) => setPatch((prev) => ({ ...prev, ...p }));

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 id={`${id}-title`} className="font-semibold">
          {t("addDealTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("addDealHelp")}</p>
      </div>
      <div role="group" aria-label={t("addDealChoose")} className="flex flex-wrap gap-2">
        {remaining.map((k) => (
          <Button
            key={k}
            variant="outline"
            size="sm"
            aria-pressed={adding === k}
            className={cn(adding === k && "border-primary bg-primary/10")}
            onClick={() => adding !== k && open(k)}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: SCENARIO_COLORS[k] }}
            />
            {t(`deals.${k}`)}
          </Button>
        ))}
      </div>

      {adding && (
        <section
          ref={form}
          aria-labelledby={`${id}-form`}
          className="scroll-mt-20 space-y-5 border-t pt-4"
        >
          <h4 id={`${id}-form`} className="font-semibold">
            {t("addDealDetails", { name: t(`deals.${adding}`) })}
          </h4>
          <NewDealFields
            deal={adding}
            invalid={tried ? missing : []}
            withPurchase={needsPurchaseFields(deals, adding)}
            deals={draft.deals}
            state={draft}
            update={change}
            updateAssumptions={change}
            loanAmount={draftOutput?.loanAmount ?? 0}
            purchasePrice={draftOutput?.purchasePrice ?? null}
            params={params}
            {...fields}
          />
          {tried && missing.length > 0 && (
            <MissingAlert>
              {t("missing", { fields: missing.map((m) => t(`missingFields.${m}`)).join(", ") })}
            </MissingAlert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              {t("addDealCancel")}
            </Button>
            <Button
              onClick={() => {
                setTried(true);
                if (!draftOutput || missing.length > 0) return focusFirstInvalid(form.current);
                onAdd(adding, patch);
                close();
              }}
            >
              {t("showResults")}
            </Button>
          </div>
        </section>
      )}

      <div className="space-y-4 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t("compareTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("compareHelp")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={comparing}
            aria-controls={`${id}-compare`}
            onClick={() => setComparing((c) => !c)}
          >
            {comparing ? t("hideComparison") : t("showComparison")}
            <ChevronDown className={cn("transition-transform", comparing && "rotate-180")} />
          </Button>
        </div>
        <div id={`${id}-compare`} hidden={!comparing}>
          {comparing && <Results output={output} onFillMissing={open} />}
        </div>
      </div>
    </section>
  );
}
