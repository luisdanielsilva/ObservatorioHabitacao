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
import { Link, useRouter } from "@/i18n/navigation";
import { writeDraft } from "@/lib/calculator/draft";
import type { CalculatorState } from "@/lib/calculator/state";

/** Saves the current inputs as a scenario, or duplicates the saved one. */
export function SaveBar({
  state,
  savedId,
  defaultName,
  autoSave = false,
  children,
}: {
  /** Save as soon as the bar appears (the user signed in to save). */
  autoSave?: boolean;
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
      // The evaluation itself is kept by the calculator; keep the name and the saved id too.
      if (r.status === "signin") writeDraft({ state, name: shownName });
      if (r.status === "saved") {
        writeDraft({ state, savedId: r.id, name: shownName });
        if (r.id !== savedId) go(r.id);
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
