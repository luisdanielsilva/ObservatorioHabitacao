"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HelpTip } from "@/components/shared/HelpTip";
import { cn } from "@/lib/utils";

/** Parses "250 000", "4,5" or "4.5"; empty → null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[\s  €%]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

type Kind = "money" | "percent" | "number";

const SUFFIX: Record<Kind, string | undefined> = { money: "€", percent: "%", number: undefined };

/** Shows a stored value as editable text: percentages as 0–100, others as plain numbers. */
function toText(value: number | null, kind: Kind, locale: string): string {
  if (value === null) return "";
  const shown = kind === "percent" ? Math.round(value * 100 * 1000) / 1000 : value;
  return shown.toLocaleString(locale === "en" ? "en-IE" : "pt-PT", {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

export function NumberInput({
  id,
  value,
  onChange,
  kind = "number",
  suffix,
  placeholder,
  locale,
  min = 0,
  className,
  required,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  kind?: Kind;
  suffix?: string;
  placeholder?: string;
  locale: string;
  min?: number;
  className?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(() => toText(value, kind, locale));
  const [synced, setSynced] = useState({ value, kind, locale });

  // Follow external changes (defaults loaded, link read, language switch) without
  // overwriting what the user is typing. Adjusting state during render, as React recommends
  // instead of an effect.
  if (synced.value !== value || synced.kind !== kind || synced.locale !== locale) {
    setSynced({ value, kind, locale });
    const parsed = parseNumber(text);
    const current = parsed === null ? null : kind === "percent" ? parsed / 100 : parsed;
    const same =
      current === value || (current !== null && value !== null && Math.abs(current - value) < 1e-9);
    if (!same || synced.locale !== locale) setText(toText(value, kind, locale));
  }

  const shownSuffix = suffix ?? SUFFIX[kind];
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className={cn("tabular-nums", shownSuffix && "pr-12")}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseNumber(e.target.value);
          if (parsed === null) return onChange(null);
          const v = kind === "percent" ? parsed / 100 : parsed;
          onChange(v < min ? min : v);
        }}
      />
      {shownSuffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {shownSuffix}
        </span>
      )}
    </div>
  );
}

/** A field label; required fields are marked with an asterisk. */
export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required && (
        <span aria-hidden className="-ml-2 text-destructive">
          *
        </span>
      )}
    </Label>
  );
}

/** A labelled number field with optional help text. */
export function NumberField({
  label,
  help,
  hint,
  className,
  ...input
}: {
  label: string;
  help?: string;
  hint?: React.ReactNode;
  className?: string;
} & Omit<Parameters<typeof NumberInput>[0], "id">) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={id} required={input.required}>
          {label}
        </FieldLabel>
        {help && <HelpTip label={label} text={help} />}
      </div>
      <NumberInput id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SwitchField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      {help && <HelpTip label={label} text={help} />}
    </div>
  );
}

export function SelectField<T extends string | number>({
  label,
  help,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  help?: string;
  required?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
        {help && <HelpTip label={label} text={help} />}
      </div>
      <select
        id={id}
        aria-required={required || undefined}
        value={String(value)}
        onChange={(e) => {
          const option = options.find((o) => String(o.value) === e.target.value);
          if (option) onChange(option.value);
        }}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A titled group of inputs. */
export function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
