"use client";

import type { ParameterSet, ScenarioKind } from "@olhovivo/engine";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { findAreaChain, type AreaTree } from "@/components/shared/AreaPicker";
import type { ReferenceResponse } from "@/app/api/reference/route";
import {
  detailsPanels,
  hasTypology,
  initialStep,
  missingDealFields,
  missingPropertyFields,
  type Step,
} from "@/lib/calculator/flow";
import { runCalculator } from "@/lib/calculator/run";
import { initialState, normaliseDeals, type CalculatorState } from "@/lib/calculator/state";
import { useFormat } from "@/lib/useFormat";
import { DetailsStep, detailsSummary } from "./DealDetails";
import { DealResults } from "./DealResults";
import { DealStep } from "./DealStep";
import { ListingStep } from "./ListingStep";
import { SaveBar } from "./SaveBar";
import { StepCard, type StepStatus } from "./StepCard";

export type Update = (patch: Partial<CalculatorState>) => void;

export interface CalculatorProps {
  tree: AreaTree;
  params: ParameterSet | null;
  euribor12m: { value: number; date: string } | null;
  initialAreaId: number | null;
  /** A saved scenario (or restored draft) to start from instead of the defaults. */
  initial?: { state: CalculatorState; savedId: number | null; name: string | null };
  /** A listing link to read straight away (from the home page). */
  initialLink?: string | null;
  /** Open the property fields for manual entry straight away. */
  startManual?: boolean;
}

export function Calculator({
  tree,
  params,
  euribor12m,
  initialAreaId,
  initial,
  initialLink,
  startManual,
}: CalculatorProps) {
  const locale = useLocale();
  const te = useTranslations("evaluate");
  const defaultRate =
    euribor12m && params ? euribor12m.value + params.financing.typicalSpread : undefined;

  const [state, setState] = useState<CalculatorState>(
    () =>
      initial?.state ??
      initialState({
        areaId: initialAreaId,
        url: initialLink ?? "",
        ...(defaultRate !== undefined && { interestRate: defaultRate }),
      }),
  );
  // A saved scenario keeps its own IMI rate rather than the area's current one.
  const [imiTouched, setImiTouched] = useState(Boolean(initial));
  // Reference data is tagged with the area it belongs to, so a stale response is never shown.
  const [loaded, setLoaded] = useState<{ areaId: number; data: ReferenceResponse | null } | null>(
    null,
  );
  const reference = state.areaId !== null && loaded?.areaId === state.areaId ? loaded.data : null;

  const update: Update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);

  // Market reference and IMI rate for the chosen area.
  useEffect(() => {
    const areaId = state.areaId;
    if (areaId === null) return;
    const controller = new AbortController();
    fetch(`/api/reference?areaId=${areaId}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ReferenceResponse>) : null))
      .then((ref) => {
        setLoaded({ areaId, data: ref });
        if (ref?.imi && !imiTouched) update({ imiRate: ref.imi.rate });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [state.areaId, imiTouched, update]);

  // The purchase month aligns AL seasonality. Results only appear once the user has entered
  // values, so the server and client renders never differ because of it.
  const [startMonth] = useState(() => new Date().getMonth() + 1);

  const deferred = useDeferredValue(state);
  const output = useMemo(() => {
    if (!params) return null;
    try {
      return runCalculator(deferred, params, startMonth);
    } catch (error) {
      console.error("calculation failed", error);
      return null;
    }
  }, [deferred, params, startMonth]);

  const areaDepth = findAreaChain(tree, state.areaId).length;
  const missingProperty = missingPropertyFields(state, areaDepth);
  const [step, setStep] = useState<Step>(() =>
    initial
      ? initialStep(initial.state, safeRun(initial.state, params, startMonth), areaDepth)
      : "property",
  );
  const deals = state.deals;
  const [panel, setPanel] = useState(0);
  const order: Step[] = ["property", "deal", "details", "results"];
  const status = (s: Step): StepStatus =>
    s === step ? "active" : order.indexOf(s) < order.indexOf(step) ? "done" : "upcoming";
  const openDetails = (atPanel = 0) => {
    setPanel(atPanel);
    setStep("details");
  };
  // From the comparison: add a strategy and open its details.
  const addDeal = (kind: ScenarioKind) => {
    const next = normaliseDeals([...deals, kind]);
    update({ deals: next });
    openDetails(detailsPanels(next).indexOf(kind));
  };

  const f = useFormat();
  const typeLabel = `${te(`types.${state.propertyType}`)}${hasTypology(state.propertyType) && state.bedrooms !== null ? ` T${state.bedrooms === 5 ? "5+" : state.bedrooms}` : ""}`;
  const location = findAreaChain(tree, state.areaId)
    .slice(1)
    .reverse()
    .map((a) => a.name)
    .join(", ");
  const propertySummary = [
    typeLabel,
    state.areaM2 !== null && `${f.number(state.areaM2)} m²`,
    state.askingPrice !== null && f.euro(state.askingPrice),
    location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <StepCard
        number={1}
        title={te("stepProperty")}
        status={status("property")}
        summary={propertySummary}
        editLabel={te("edit")}
        onEdit={() => setStep("property")}
      >
        <ListingStep
          state={state}
          update={update}
          tree={tree}
          reference={reference}
          missing={missingProperty}
          autoRead={Boolean(initialLink)}
          startManual={startManual}
          onContinue={() => setStep(initialStep(state, output, areaDepth))}
          locale={locale}
        />
      </StepCard>

      <StepCard
        number={2}
        title={te("stepDeal")}
        status={status("deal")}
        summary={deals.map((d) => te(`deals.${d}`)).join(", ")}
        editLabel={te("edit")}
        onEdit={() => setStep("deal")}
      >
        <DealStep
          deals={deals}
          onChange={(next) => update({ deals: next })}
          onContinue={() => openDetails()}
        />
      </StepCard>

      <StepCard
        number={3}
        title={te("stepDetails")}
        status={status("details")}
        summary={detailsSummary(deals, state, f, (key, values) => te(key, values))}
        editLabel={te("edit")}
        onEdit={() => openDetails()}
      >
        {deals.length > 0 && (
          <DetailsStep
            deals={deals}
            state={state}
            update={update}
            updateAssumptions={(patch) => {
              if ("imiRate" in patch) setImiTouched(true);
              update(patch);
            }}
            reference={reference}
            loanAmount={output?.loanAmount ?? 0}
            purchasePrice={output?.purchasePrice ?? null}
            params={params}
            euribor12m={euribor12m}
            spread={params?.financing.typicalSpread ?? null}
            nonResidentRule={params?.imt.nonResidentHousingRate !== undefined}
            missing={(d) => missingDealFields(output, d)}
            panel={panel}
            onPanelChange={setPanel}
            onShowResults={() => setStep("results")}
            locale={locale}
          />
        )}
      </StepCard>

      <StepCard
        number={4}
        title={te("stepResults")}
        status={status("results")}
        editLabel={te("edit")}
      >
        {deals.length > 0 && (
          <>
            <SaveBar
              state={state}
              savedId={initial?.savedId ?? null}
              defaultName={
                initial?.name ??
                defaultScenarioName(
                  state,
                  tree,
                  (key, values) => te(key, values),
                  (type) => te(`types.${type}`),
                )
              }
            />
            <DealResults
              deals={deals}
              output={output}
              state={state}
              params={params}
              startMonth={startMonth}
              onGoalChange={(goal) => update({ goal })}
              onAddDeal={addDeal}
            />
          </>
        )}
      </StepCard>
    </div>
  );
}

function safeRun(state: CalculatorState, params: ParameterSet | null, startMonth: number) {
  if (!params) return null;
  try {
    return runCalculator(state, params, startMonth);
  } catch {
    return null;
  }
}

/** e.g. "Apartamento T2 em Arroios". */
function defaultScenarioName(
  state: CalculatorState,
  tree: AreaTree,
  t: (key: "defaultName" | "defaultNameNoArea", values: { type: string; area?: string }) => string,
  typeLabel: (type: CalculatorState["propertyType"]) => string,
): string {
  const type = `${typeLabel(state.propertyType)}${hasTypology(state.propertyType) && state.bedrooms !== null ? ` T${state.bedrooms === 5 ? "5+" : state.bedrooms}` : ""}`;
  const area = findAreaChain(tree, state.areaId).at(-1)?.name;
  return area ? t("defaultName", { type, area }) : t("defaultNameNoArea", { type });
}
