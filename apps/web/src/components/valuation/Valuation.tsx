"use client";

import type { ParameterSet } from "@observatorio-habitacao/engine";
import { FolderOpen, RotateCcw, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { saveValuation, type SaveValuationResult } from "@/app/[locale]/vender/actions";
import { ComparablesSection } from "@/components/calculator/ComparablesSection";
import { ReportShare, type ReportMember } from "@/components/share/ReportShare";
import { withBasePath } from "@/lib/basePath";
import { StepCard, type StepStatus } from "@/components/calculator/StepCard";
import { findAreaChain, type AreaTree } from "@/components/shared/AreaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { hasTypology } from "@/lib/calculator/flow";
import { useFormat } from "@/lib/useFormat";
import { writeValuationDraft } from "@/lib/valuation/draft";
import { estimateValue } from "@/lib/valuation/estimate";
import { missingValuationFields, VALUATION_STEPS, type ValuationStep } from "@/lib/valuation/flow";
import { ineBase } from "@/lib/valuation/ine";
import { sellerProceeds } from "@/lib/valuation/proceeds";
import { hasSaleDetails, initialValuation, type ValuationState } from "@/lib/valuation/state";
import { PropertyStep, type UpdateValuation } from "./PropertyStep";
import { SaleStep } from "./SaleStep";
import { ValuationResult } from "./ValuationResult";

export interface ValuationProps {
  tree: AreaTree;
  params: ParameterSet | null;
  initialAreaId?: number | null;
  /** A saved valuation (or restored draft) to start from. */
  initial?: {
    state: ValuationState;
    savedId: number | null;
    name: string | null;
  };
  /** Save straight away (back from signing in to save). */
  autoSave?: boolean;
  onReset?: () => void;
  /** The signed-in user (with a profile) and whether their plan saves; null when signed out. */
  member: (ReportMember & { canSave: boolean }) | null;
}

/**
 * Vender: the seller describes their property and gets its likely value, a range and an asking
 * price (lib/valuation), and, with the sale's details, what they keep after the commission, the
 * IRS on the gain and the loan.
 */
export function Valuation({
  tree,
  params,
  initialAreaId = null,
  initial,
  autoSave,
  onReset,
  member,
}: ValuationProps) {
  const t = useTranslations("sell");
  const te = useTranslations("evaluate");
  const locale = useLocale();
  const f = useFormat();

  const [state, setState] = useState<ValuationState>(
    () => initial?.state ?? initialValuation({ areaId: initialAreaId }),
  );
  const update: UpdateValuation = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);
  const [savedId, setSavedId] = useState<number | null>(initial?.savedId ?? null);
  const [name, setName] = useState<string | null>(initial?.name ?? null);
  // The sale step was filled in or skipped: proceeds are shown once it was filled in.
  const [saleDone, setSaleDone] = useState(() => Boolean(initial && hasSaleDetails(initial.state)));

  useEffect(() => writeValuationDraft({ state, savedId }), [state, savedId]);

  // INE median of the area, tagged with the area so a stale response is never used.
  const [loaded, setLoaded] = useState<{ areaId: number; data: ReferenceResponse | null } | null>(
    null,
  );
  useEffect(() => {
    const areaId = state.areaId;
    if (areaId === null) return;
    const controller = new AbortController();
    fetch(withBasePath(`/api/reference?areaId=${areaId}`), { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ReferenceResponse>) : null))
      .then((data) => setLoaded({ areaId, data }))
      .catch(() => {});
    return () => controller.abort();
  }, [state.areaId]);
  const reference = state.areaId !== null && loaded?.areaId === state.areaId ? loaded.data : null;

  const valuation = useMemo(
    () => estimateValue(state, ineBase(reference?.sale ?? null)),
    [state, reference],
  );
  const salePrice = state.salePrice ?? valuation?.likely ?? null;
  const proceeds = useMemo(
    () =>
      saleDone && params && salePrice
        ? sellerProceeds(state, salePrice, params, new Date().getFullYear())
        : null,
    [saleDone, params, salePrice, state],
  );

  const chain = findAreaChain(tree, state.areaId);
  const missing = missingValuationFields(state, chain.length);
  const [step, setStep] = useState<ValuationStep>(() =>
    initial &&
    missingValuationFields(initial.state, findAreaChain(tree, initial.state.areaId).length)
      .length === 0
      ? "results"
      : "property",
  );
  const status = (s: ValuationStep): StepStatus =>
    s === step
      ? "active"
      : VALUATION_STEPS.indexOf(s) < VALUATION_STEPS.indexOf(step)
        ? "done"
        : "upcoming";

  const location = chain
    .slice(1)
    .reverse()
    .map((a) => a.name)
    .join(", ");
  const typeLabel = `${te(`types.${state.propertyType}`)}${hasTypology(state.propertyType) && state.bedrooms !== null ? ` T${state.bedrooms === 5 ? "5+" : state.bedrooms}` : ""}`;
  const shownName =
    name ??
    (chain.at(-1)
      ? te("defaultName", { type: typeLabel, area: chain.at(-1)!.name })
      : te("defaultNameNoArea", { type: typeLabel }));
  const started = step !== "property" || state.areaId !== null || savedId !== null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {onReset && started && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw />
            {t("newValuation")}
          </Button>
        </div>
      )}

      <StepCard
        number={1}
        title={t("stepProperty")}
        status={status("property")}
        summary={[typeLabel, state.areaM2 !== null && `${f.number(state.areaM2)} m²`, location]
          .filter(Boolean)
          .join(" · ")}
        editLabel={te("edit")}
        onEdit={() => setStep("property")}
      >
        <PropertyStep
          state={state}
          update={update}
          tree={tree}
          missing={missing}
          onContinue={() => setStep("comparables")}
          locale={locale}
        />
      </StepCard>

      <StepCard
        number={2}
        title={t("stepComparables")}
        status={status("comparables")}
        summary={
          state.comparables.length > 0
            ? t("comparablesSummary", { count: state.comparables.length })
            : t("comparablesNone")
        }
        editLabel={te("edit")}
        onEdit={() => setStep("comparables")}
      >
        <ComparablesSection
          subject={{ ...state, askingPrice: null }}
          onChange={(comparables) => update({ comparables })}
          locationOf={(areaId) =>
            findAreaChain(tree, areaId)
              .slice(1)
              .reverse()
              .map((a) => a.name)
              .join(", ")
          }
          locale={locale}
          intro={t("comparablesIntro")}
          showSummary={false}
        />
        <div className="flex justify-end">
          <Button onClick={() => setStep("sale")}>
            {state.comparables.length > 0 ? te("continue") : t("continueWithout")}
          </Button>
        </div>
      </StepCard>

      <StepCard
        number={3}
        title={t("stepSale")}
        status={status("sale")}
        summary={
          proceeds ? t("saleSummary", { price: f.euro(proceeds.salePrice) }) : t("saleSkipped")
        }
        editLabel={te("edit")}
        onEdit={() => setStep("sale")}
      >
        <SaleStep
          state={state}
          update={update}
          likely={valuation?.likely ?? null}
          onContinue={() => {
            setSaleDone(true);
            setStep("results");
          }}
          onSkip={() => {
            setSaleDone(false);
            setStep("results");
          }}
          locale={locale}
        />
      </StepCard>

      <StepCard
        number={4}
        title={t("stepResult")}
        status={status("results")}
        editLabel={te("edit")}
      >
        {valuation ? (
          <>
            <ValuationResult
              state={state}
              valuation={valuation}
              series={reference?.saleSeries ?? []}
              proceeds={proceeds}
              onEditSale={() => setStep("sale")}
            />
            <ValuationSaveBar
              state={state}
              name={shownName}
              onNameChange={setName}
              savedId={savedId}
              onSaved={(id) => {
                setSavedId(id);
                window.history.replaceState(null, "", `?avaliacao=${id}`);
              }}
              autoSave={autoSave}
              canSave={member ? member.canSave || savedId !== null : null}
            />
            <ReportShare
              input={() => ({ kind: "valuation", name: shownName, state })}
              member={member}
              returnTo="/vender"
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {reference || state.areaId === null ? t("noEstimate") : t("loading")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </StepCard>
    </div>
  );
}

/** Saves the valuation to the account, part of the paid plan (issue #5). */
function ValuationSaveBar({
  state,
  name,
  onNameChange,
  savedId,
  onSaved,
  autoSave = false,
  canSave,
}: {
  state: ValuationState;
  name: string;
  onNameChange: (name: string) => void;
  savedId: number | null;
  onSaved: (id: number) => void;
  autoSave?: boolean;
  /** Whether the signed-in user's plan saves; null when not signed in. */
  canSave: boolean | null;
}) {
  const t = useTranslations("sell");
  const te = useTranslations("evaluate");
  const locale = useLocale();
  const id = useId();
  const [result, setResult] = useState<SaveValuationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await saveValuation({ id: savedId, name, state });
      setResult(r);
      if (r.status === "saved") onSaved(r.id);
    });

  const autoSaved = useRef(false);
  useEffect(() => {
    if (!autoSave || autoSaved.current) return;
    autoSaved.current = true;
    save();
    // Runs once, when the bar first appears (back from signing in to save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message =
    result?.status === "saved"
      ? te("saved")
      : result?.status === "limit"
        ? te("limitReached")
        : result?.status === "invalid" || result?.status === "error"
          ? te("saveError")
          : null;
  const back = `${locale === "pt" ? "" : `/${locale}`}/vender?rascunho=1`;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border bg-card p-5">
      <h2 id={`${id}-title`} className="sr-only">
        {t("saveTitle")}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`${id}-name`}>{t("valuationName")}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={120}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={pending}>
          <Save />
          {pending ? te("saving") : savedId ? te("saveChanges") : te("save")}
        </Button>
        {canSave !== true && (
          <span className="self-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {te("paidPlan")}
          </span>
        )}
        {savedId && (
          <Button asChild variant="ghost">
            <Link href="/conta">
              <FolderOpen />
              {t("myValuations")}
            </Link>
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result?.status === "signin" ? (
          <>
            {t("signinToSave")}{" "}
            <Link
              href={{ pathname: "/entrar", query: { voltar: back } }}
              className="font-medium text-primary underline"
            >
              {te("signinToSaveLink")} →
            </Link>
          </>
        ) : result?.status === "plan" ? (
          <>
            {t("savePaidOnly")}{" "}
            <Link href="/contactos" className="font-medium text-primary underline">
              {te("paidPlanContact")} →
            </Link>
          </>
        ) : (
          message
        )}
      </p>
    </section>
  );
}
