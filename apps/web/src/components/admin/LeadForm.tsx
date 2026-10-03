"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateLeadAction, type FormState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/shared/AreaPicker";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;

export function LeadForm({
  id,
  status,
  notes,
  assigneeId,
  admins,
}: {
  id: number;
  status: (typeof STATUSES)[number];
  notes: string | null;
  assigneeId: string | null;
  admins: { id: string; label: string }[];
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<FormState, FormData>(updateLeadAction, {
    status: "idle",
  });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("leads.status")}</Label>
          <select id="status" name="status" defaultValue={status} className={selectClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`leadStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assigneeId">{t("leads.assignee")}</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={assigneeId ?? ""}
            className={selectClass}
          >
            <option value="">{t("leads.unassigned")}</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("leads.notes")}</Label>
        <textarea
          id="notes"
          name="notes"
          rows={5}
          maxLength={5000}
          defaultValue={notes ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("leads.save")}
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {state.status === "ok" ? t("saved") : state.status === "error" ? t("error") : null}
        </span>
      </div>
    </form>
  );
}
