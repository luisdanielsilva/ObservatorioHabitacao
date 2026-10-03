"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaPicker, type AreaTree } from "@/components/shared/AreaPicker";
import { requestSalesSupport, type LeadState } from "./actions";

export function SalesSupportForm({ tree }: { tree: AreaTree }) {
  const t = useTranslations("sell");
  const [state, action, pending] = useActionState<LeadState, FormData>(requestSalesSupport, {
    status: "idle",
  });
  const [areaId, setAreaId] = useState<number | null>(null);

  if (state.status === "success") {
    return (
      <Alert>
        <AlertDescription>{t("success")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("area")}</legend>
        <AreaPicker tree={tree} value={areaId} onChange={setAreaId} />
        <input type="hidden" name="areaId" value={areaId ?? ""} />
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="message">{t("message")}</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      {/* Honeypot, hidden from people and assistive technology. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <div className="flex items-start gap-3">
        <Checkbox id="consent" name="consent" required className="mt-0.5" />
        <Label htmlFor="consent" className="leading-snug font-normal">
          {t("consent")}
        </Label>
      </div>

      {(state.status === "invalid" || state.status === "error") && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.status === "invalid" ? t("required") : t("error")}
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
