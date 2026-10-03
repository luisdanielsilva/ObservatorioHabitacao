"use client";

import type { ParameterSet } from "@olhovivo/engine";
import { useLocale } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { AreaTree } from "@/components/shared/AreaPicker";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { runCalculator } from "@/lib/calculator/run";
import { initialState, type CalculatorState } from "@/lib/calculator/state";
import { AssumptionsSection } from "./AssumptionsSection";
import { FinancingSection } from "./FinancingSection";
import { MarketValuesSection } from "./MarketValuesSection";
import { PropertySection } from "./PropertySection";
import { Results } from "./Results";

export type Update = (patch: Partial<CalculatorState>) => void;

export interface CalculatorProps {
  tree: AreaTree;
  params: ParameterSet | null;
  euribor12m: { value: number; date: string } | null;
  initialAreaId: number | null;
}

export function Calculator({ tree, params, euribor12m, initialAreaId }: CalculatorProps) {
  const locale = useLocale();
  const defaultRate =
    euribor12m && params ? euribor12m.value + params.financing.typicalSpread : undefined;

  const [state, setState] = useState<CalculatorState>(() =>
    initialState({
      areaId: initialAreaId,
      ...(defaultRate !== undefined && { interestRate: defaultRate }),
    }),
  );
  const [imiTouched, setImiTouched] = useState(false);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <PropertySection
          state={state}
          update={update}
          tree={tree}
          reference={reference}
          locale={locale}
        />
        <MarketValuesSection
          state={state}
          update={update}
          reference={reference}
          opportunity={output?.opportunity ?? null}
          locale={locale}
        />
        <FinancingSection
          state={state}
          update={update}
          loanAmount={output?.loanAmount ?? 0}
          purchasePrice={output?.purchasePrice ?? null}
          euribor12m={euribor12m}
          spread={params?.financing.typicalSpread ?? null}
          locale={locale}
        />
        <AssumptionsSection
          state={state}
          update={(patch) => {
            if ("imiRate" in patch) setImiTouched(true);
            update(patch);
          }}
          locale={locale}
        />
      </div>
      <div className="min-w-0">
        <Results
          output={output}
          goal={state.goal}
          onGoalChange={(goal) => update({ goal })}
          paramsYear={params?.year ?? null}
        />
      </div>
    </div>
  );
}
