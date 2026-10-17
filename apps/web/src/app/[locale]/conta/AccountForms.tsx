"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/shared/AreaPicker";
import {
  deleteMyAccount,
  deleteSavedScenario,
  deleteSavedValuation,
  saveSettings,
  type DeleteState,
  type SettingsState,
} from "./actions";

export function DeleteScenarioButton({ id, name }: { id: number; name: string }) {
  const t = useTranslations("account");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`${t("delete")}: ${name}`}
      onClick={() => {
        if (confirm(t("confirmDelete", { name })))
          start(async () => void (await deleteSavedScenario(id)));
      }}
    >
      <Trash2 />
      {t("delete")}
    </Button>
  );
}

export function DeleteValuationButton({ id, name }: { id: number; name: string }) {
  const t = useTranslations("account");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`${t("delete")}: ${name}`}
      onClick={() => {
        if (confirm(t("confirmDeleteValuation", { name })))
          start(async () => void (await deleteSavedValuation(id)));
      }}
    >
      <Trash2 />
      {t("delete")}
    </Button>
  );
}

export function SettingsForm({
  name,
  locale,
  consents,
}: {
  name: string | null;
  locale: "pt" | "en";
  consents: { marketing: boolean; partners: boolean };
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {
    status: "idle",
  });
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("name")}</Label>
          <Input
            id="name"
            name="name"
            defaultValue={name ?? ""}
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="locale">{t("language")}</Label>
          <select id="locale" name="locale" defaultValue={locale} className={selectClass}>
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("consents")}</legend>
        {(["marketing", "partners"] as const).map((purpose) => (
          <div key={purpose} className="flex items-start gap-3">
            <Checkbox
              id={purpose}
              name={purpose}
              defaultChecked={consents[purpose]}
              className="mt-0.5"
            />
            <Label htmlFor={purpose} className="leading-snug font-normal">
              {t(purpose === "marketing" ? "consentMarketing" : "consentPartners")}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("saveSettings")}
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {state.status === "saved" && t("settingsSaved")}
        </span>
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteMyAccount, {
    status: "idle",
  });
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("deleteHelp")}</p>
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="confirm">{t("deleteConfirmLabel")}</Label>
        <Input id="confirm" name="confirm" autoComplete="off" />
      </div>
      {state.status !== "idle" && (
        <Alert variant="destructive">
          <AlertDescription>{t("deleteConfirmLabel")}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="destructive" disabled={pending}>
        {t("deleteButton")}
      </Button>
    </form>
  );
}
