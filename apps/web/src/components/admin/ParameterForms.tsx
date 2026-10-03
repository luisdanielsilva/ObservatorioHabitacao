"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  activateAction,
  createDraftAction,
  verifyAction,
  type FormState,
} from "@/app/[locale]/admin/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function VerifyForm({ id }: { id: number }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<FormState, FormData>(verifyAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="verifiedBy">{t("params.verifyLabel")}</Label>
        <Input id="verifiedBy" name="verifiedBy" required maxLength={120} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {t("params.verifyButton")}
      </Button>
      <p className="w-full text-sm text-muted-foreground" aria-live="polite">
        {state.status === "ok"
          ? t("params.verifiedDone")
          : state.status === "error"
            ? t("error")
            : null}
      </p>
    </form>
  );
}

export function ActivateForm({ id, help }: { id: number; help: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<FormState, FormData>(activateAction, {
    status: "idle",
  });
  if (state.status === "ok") {
    return (
      <Alert>
        <AlertDescription>{t("params.activated")}</AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground">{help}</p>
      <div className="flex items-start gap-3">
        <Checkbox id="confirm" name="confirm" required className="mt-0.5" />
        <Label htmlFor="confirm" className="font-normal">
          {t("params.activateConfirm")}
        </Label>
      </div>
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{t("error")}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {t("params.activate")}
      </Button>
    </form>
  );
}

export function DraftForm({ json }: { json: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<FormState, FormData>(createDraftAction, {
    status: "idle",
  });
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("params.newDraftHelp")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="json">{t("params.json")}</Label>
        <textarea
          id="json"
          name="json"
          defaultValue={json}
          rows={22}
          spellCheck={false}
          className={`${textareaClass} font-mono text-xs`}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("params.draftNotes")}</Label>
        <textarea id="notes" name="notes" rows={3} maxLength={5000} className={textareaClass} />
      </div>
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.errors?.[0] === "json" ? (
              t("params.invalidJson")
            ) : (
              <>
                {t("params.validationErrors")}
                <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                  {state.errors?.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      {state.status === "ok" && state.id && (
        <Alert>
          <AlertDescription>
            {t("params.draftCreated")}{" "}
            <Link href={`/admin/parametros/${state.id}`} className="font-medium underline">
              {t("params.view")}
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {t("params.createDraft")}
      </Button>
    </form>
  );
}
