"use client";

import { CheckCircle2, Lightbulb, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { sendContactRequest, type ContactState } from "./actions";

type Type = "support" | "feature";

/**
 * Support request or feature suggestion (issue #3), as on the other SingleUseApps sites: type,
 * name, email, title and description. A signed-in user's name and email are filled in.
 */
export function ContactForm({
  defaults,
  initialType = "support",
}: {
  defaults: { name: string; email: string };
  initialType?: Type;
}) {
  const t = useTranslations("contact");
  const id = useId();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactRequest, {
    status: "idle",
  });
  const [type, setType] = useState<Type>(initialType);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-2xl border-2 border-primary/30 bg-mint-soft p-6">
        <CheckCircle2 className="size-7 text-primary" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">{t("sentTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("sentText")}</p>
      </div>
    );
  }

  const values = "values" in state ? state.values : undefined;
  const wrong = new Set("fields" in state ? state.fields : []);
  const field = (
    name: "name" | "email" | "title" | "description",
    input: (props: {
      id: string;
      name: string;
      "aria-invalid": boolean;
      "aria-describedby"?: string;
    }) => React.ReactNode,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${name}`}>{t(`fields.${name}`)}</Label>
      {input({
        id: `${id}-${name}`,
        name,
        "aria-invalid": wrong.has(name),
        "aria-describedby": wrong.has(name) ? `${id}-${name}-error` : undefined,
      })}
      {wrong.has(name) && (
        <p id={`${id}-${name}-error`} className="text-sm text-destructive">
          {t(`errors.${name}`)}
        </p>
      )}
    </div>
  );

  return (
    <form action={action} className="space-y-5" noValidate key={JSON.stringify(state)}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("fields.type")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["support", LifeBuoy],
              ["feature", Lightbulb],
            ] as const
          ).map(([value, Icon]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                type === value
                  ? "border-2 border-primary bg-mint-soft p-[11px]"
                  : "hover:border-primary/50",
              )}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold">{t(`types.${value}.label`)}</span>
                <span className="block text-sm text-muted-foreground">
                  {t(`types.${value}.hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", (p) => (
          <Input
            {...p}
            defaultValue={values?.name ?? defaults.name}
            maxLength={80}
            autoComplete="name"
            required
          />
        ))}
        {field("email", (p) => (
          <Input
            {...p}
            type="email"
            defaultValue={values?.email ?? defaults.email}
            maxLength={120}
            autoComplete="email"
            required
          />
        ))}
      </div>
      {field("title", (p) => (
        <Input
          {...p}
          defaultValue={values?.title ?? ""}
          maxLength={120}
          placeholder={t(`types.${type}.titlePlaceholder`)}
          required
        />
      ))}
      {field("description", (p) => (
        <textarea
          {...p}
          defaultValue={values?.description ?? ""}
          maxLength={4000}
          rows={6}
          placeholder={t(`types.${type}.descriptionPlaceholder`)}
          required
          className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
        />
      ))}

      {/* Hidden from people; bots fill it in. */}
      <div className="hidden" aria-hidden>
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {(state.status === "limit" || state.status === "error") && (
        <Alert variant="destructive">
          <AlertDescription>{t(state.status === "limit" ? "limit" : "error")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" size="lg" disabled={pending}>
          {t("submit")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t.rich("privacy", {
            link: (chunks) => (
              <Link href="/privacidade" className="font-medium text-primary underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  );
}
