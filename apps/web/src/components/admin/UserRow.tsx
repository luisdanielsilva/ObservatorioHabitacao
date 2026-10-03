"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { updateUserAction, type FormState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/shared/AreaPicker";
import { td } from "./ui";

export function UserRow({
  user,
  created,
  isSelf,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "user" | "admin";
    plan: "free" | "premium";
  };
  created: string;
  isSelf: boolean;
}) {
  const t = useTranslations("admin");
  const formId = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(updateUserAction, {
    status: "idle",
  });
  return (
    <tr>
      <td className={td}>
        <span className="break-all">{user.email}</span>
        {user.name && <span className="block text-xs text-muted-foreground">{user.name}</span>}
      </td>
      <td className={td}>{created}</td>
      <td className={td}>
        <select
          form={formId}
          name="role"
          defaultValue={user.role}
          aria-label={`${t("users.role")}: ${user.email}`}
          className={selectClass}
          disabled={isSelf}
        >
          {(["user", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`users.roles.${r}`)}
            </option>
          ))}
        </select>
        {/* A disabled select is not submitted: send the current role explicitly. */}
        {isSelf && <input type="hidden" form={formId} name="role" value={user.role} />}
      </td>
      <td className={td}>
        <select
          form={formId}
          name="plan"
          defaultValue={user.plan}
          aria-label={`${t("users.plan")}: ${user.email}`}
          className={selectClass}
        >
          {(["free", "premium"] as const).map((p) => (
            <option key={p} value={p}>
              {t(`users.plans.${p}`)}
            </option>
          ))}
        </select>
      </td>
      <td className={td}>
        <form id={formId} action={action} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {t("users.save")}
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {state.status === "ok"
              ? t("saved")
              : state.errors?.[0] === "ownRole"
                ? t("users.ownRole")
                : state.status === "error"
                  ? t("error")
                  : null}
          </span>
        </form>
      </td>
    </tr>
  );
}
