"use client";

import { Copy, FolderOpen, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  duplicateSavedScenario,
  saveScenario,
  type SaveResult,
} from "@/app/[locale]/avaliar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { CalculatorState } from "@/lib/calculator/state";
import { scenarioKey, type SavedScenario } from "./saved";

/** Where to sign in to save, coming back to the evaluation in progress and saving it. */
export function signInToSaveHref(locale: string) {
  return {
    pathname: "/entrar" as const,
    query: { voltar: `${locale === "pt" ? "" : `/${locale}`}/avaliar?rascunho=1` },
  };
}

/** Saves the current inputs as a scenario, or duplicates the saved one. */
export function SaveBar({
  state,
  name,
  onNameChange,
  saved,
  currentKey,
  onSaved,
  autoSave = false,
  children,
}: {
  /** Save as soon as the bar appears (the user signed in to save). */
  autoSave?: boolean;
  state: CalculatorState;
  name: string;
  onNameChange: (name: string) => void;
  saved: SavedScenario | null;
  /** The current name and inputs, recorded as saved after a save. */
  currentKey: string;
  onSaved: (saved: SavedScenario) => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const locale = useLocale();
  const [result, setResult] = useState<SaveResult | { status: "duplicated" } | null>(null);
  const [pending, startTransition] = useTransition();
  const savedId = saved?.id ?? null;

  const save = () =>
    startTransition(async () => {
      const key = currentKey;
      const r = await saveScenario({ id: savedId, name, state });
      setResult(r);
      if (r.status === "saved") {
        onSaved({ id: r.id, key, token: r.id === savedId ? (saved?.token ?? null) : null });
      }
    });

  // Back from signing in to save: finish the save the user asked for.
  const autoSaved = useRef(false);
  useEffect(() => {
    if (!autoSave || autoSaved.current) return;
    autoSaved.current = true;
    save();
    // Runs once, when the bar first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A copy of the scenario as last saved; unsaved changes stay on screen, now for the copy.
  const duplicate = () =>
    startTransition(async () => {
      if (!savedId) return;
      const copyName = `${name} ${t("copySuffix")}`;
      const r = await duplicateSavedScenario(savedId, copyName);
      if (r.status === "saved") {
        setResult({ status: "duplicated" });
        onNameChange(copyName);
        const inSync = saved?.key === currentKey;
        onSaved({ id: r.id, key: inSync ? scenarioKey(copyName, state) : null, token: null });
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
            value={name}
            maxLength={120}
            onChange={(e) => onNameChange(e.target.value)}
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
        {savedId && (
          <Button asChild variant="ghost">
            <Link href="/conta">
              <FolderOpen />
              {t("myScenarios")}
            </Link>
          </Button>
        )}
        {children}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result?.status === "signin" ? (
          <>
            {t("signinToSave")}{" "}
            <Link href={signInToSaveHref(locale)} className="font-medium text-primary underline">
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
