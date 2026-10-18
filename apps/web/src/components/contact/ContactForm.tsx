"use client";

import { CheckCircle2, ChevronUp, Lightbulb, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { sendContactRequest, type ContactState } from "./actions";

export type ContactType = "support" | "feature";
type Type = ContactType;

/**
 * Support request or feature suggestion (issue #3), as on the other SingleUseApps sites: type,
 * name, email, title and description. A signed-in user's name and email are filled in.
 *
 * Given a `type`, the form has no type picker of its own: whoever shows it chose the type (the
 * home page's contact box). `onSent` and `onClose` let that box react to a sent request.
 */
export function ContactForm({
  defaults,
  initialType = "support",
  type: fixedType,
  onSent,
  onClose,
}: {
  defaults: { name: string; email: string };
  initialType?: Type;
  type?: Type;
  onSent?: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations("contact");
  const id = useId();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactRequest, {
    status: "idle",
  });
  const [chosenType, setType] = useState<Type>(initialType);
  const type = fixedType ?? chosenType;
  const sent = state.status === "sent";

  useEffect(() => {
    if (sent) onSent?.();
  }, [sent, onSent]);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-2xl border-2 border-primary/30 bg-mint-soft p-6">
        <CheckCircle2 className="size-7 text-primary" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">{t("sentTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("sentText")}</p>
        {onClose && (
          <Button type="button" variant="outline" className="mt-4" onClick={onClose}>
            <ChevronUp aria-hidden />
            {t("close")}
          </Button>
        )}
      </div>
    );
  }

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
    // Submitted by hand rather than through `action`, so React doesn't reset what was typed.
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {fixedType ? (
        <input type="hidden" name="type" value={fixedType} />
      ) : (
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
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", (p) => (
          <Input {...p} defaultValue={defaults.name} maxLength={80} autoComplete="name" required />
        ))}
        {field("email", (p) => (
          <Input
            {...p}
            type="email"
            defaultValue={defaults.email}
            maxLength={120}
            autoComplete="email"
            required
          />
        ))}
      </div>
      {field("title", (p) => (
        <Input {...p} maxLength={120} placeholder={t(`types.${type}.titlePlaceholder`)} required />
      ))}
      {field("description", (p) => (
        <textarea
          {...p}
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
