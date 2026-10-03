"use client";

import { Copy, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  duplicateSavedScenario,
  saveScenario,
  type SaveResult,
} from "@/app/[locale]/avaliar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import type { CalculatorState } from "@/lib/calculator/state";

export const DRAFT_KEY = "olhovivo:calculator-draft";

/** Saves the current inputs as a scenario, or duplicates the saved one. */
export function SaveBar({
  state,
  savedId,
  defaultName,
  children,
}: {
  state: CalculatorState;
  savedId: number | null;
  defaultName: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const router = useRouter();
  const locale = useLocale();
  const [name, setName] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | { status: "duplicated" } | null>(null);
  const [pending, startTransition] = useTransition();
  const shownName = name ?? defaultName;

  const go = (scenarioId: number) =>
    router.replace(
      { pathname: "/avaliar", query: { cenario: String(scenarioId) } },
      { scroll: false },
    );

  const save = () =>
    startTransition(async () => {
      const r = await saveScenario({ id: savedId, name: shownName, state });
      setResult(r);
      if (r.status === "signin") {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: shownName, state }));
        } catch {
          // Storage unavailable (private mode): the user can still sign in and re-enter values.
        }
      }
      if (r.status === "saved") {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
        if (r.id !== savedId) go(r.id);
      }
    });

  const duplicate = () =>
    startTransition(async () => {
      if (!savedId) return;
      const r = await duplicateSavedScenario(savedId, `${shownName} ${t("copySuffix")}`);
      if (r.status === "saved") {
        setResult({ status: "duplicated" });
        setName(`${shownName} ${t("copySuffix")}`);
        go(r.id);
      } else setResult(r);
    });

  const message =
    result?.status === "saved"
      ? t("saved")
      : result?.status === "duplicated"
        ? t("duplicated")
        : result?.status === "limit"
          ? t("limitReached")
          : result?.status === "invalid" || result?.status === "error"
            ? t("saveError")
            : null;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border bg-card p-5">
      <h2 id={`${id}-title`} className="sr-only">
        {t("saveTitle")}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`${id}-name`}>{t("scenarioName")}</Label>
          <Input
            id={`${id}-name`}
            value={shownName}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={pending}>
          <Save />
          {pending ? t("saving") : savedId ? t("saveChanges") : t("save")}
        </Button>
        {savedId && (
          <Button variant="outline" onClick={duplicate} disabled={pending}>
            <Copy />
            {t("duplicate")}
          </Button>
        )}
        {children}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result?.status === "signin" ? (
          <>
            {t("signinToSave")}{" "}
            <Link
              href={{
                pathname: "/entrar",
                query: { voltar: `${locale === "pt" ? "" : `/${locale}`}/avaliar?rascunho=1` },
              }}
              className="font-medium text-primary underline"
            >
              {t("save")} →
            </Link>
          </>
        ) : (
          message
        )}
      </p>
    </section>
  );
}
