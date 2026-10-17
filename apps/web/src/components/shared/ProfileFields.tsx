"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_AGE, type ProfileError } from "@/lib/profile";

/**
 * Name (required), phone and date of birth (optional): the profile asked for after the first
 * sign-in and edited in the account settings (issue #7).
 */
export function ProfileFields({
  errors,
  defaults,
  autoFocus,
}: {
  errors: ProfileError[];
  defaults: { name: string; phone: string; birthDate: string };
  autoFocus?: boolean;
}) {
  const t = useTranslations("profile");
  const id = useId();
  const birthError = errors.includes("tooYoung")
    ? "tooYoung"
    : errors.includes("birthDate")
      ? "birthDate"
      : null;
  // The latest date of birth that is old enough, as the date picker's limit.
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() - MIN_AGE);

  const field = (
    name: "name" | "phone" | "birthDate",
    error: ProfileError | null,
    input: React.ReactNode,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${name}`}>
        {t(`fields.${name}`)}
        {name !== "name" && (
          <span className="font-normal text-muted-foreground"> ({t("optional")})</span>
        )}
      </Label>
      {input}
      <p id={`${id}-${name}-help`} className="text-xs text-muted-foreground">
        {t(`help.${name}`)}
      </p>
      {error && (
        <p id={`${id}-${name}-error`} className="text-sm text-destructive">
          {t(`errors.${error}`, { age: MIN_AGE })}
        </p>
      )}
    </div>
  );
  const described = (name: string, error: ProfileError | null) =>
    [`${id}-${name}-help`, error ? `${id}-${name}-error` : ""].filter(Boolean).join(" ");

  const nameError = errors.includes("name") ? "name" : null;
  const phoneError = errors.includes("phone") ? "phone" : null;
  return (
    <div className="space-y-4">
      {field(
        "name",
        nameError,
        <Input
          id={`${id}-name`}
          name="name"
          defaultValue={defaults.name}
          required
          maxLength={120}
          autoComplete="name"
          autoFocus={autoFocus}
          aria-invalid={Boolean(nameError)}
          aria-describedby={described("name", nameError)}
        />,
      )}
      {field(
        "phone",
        phoneError,
        <Input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          maxLength={30}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+351 912 345 678"
          aria-invalid={Boolean(phoneError)}
          aria-describedby={described("phone", phoneError)}
        />,
      )}
      {field(
        "birthDate",
        birthError,
        <Input
          id={`${id}-birthDate`}
          name="birthDate"
          type="date"
          defaultValue={defaults.birthDate}
          max={latest.toISOString().slice(0, 10)}
          min="1900-01-01"
          autoComplete="bday"
          className="w-full sm:w-56"
          aria-invalid={Boolean(birthError)}
          aria-describedby={described("birthDate", birthError)}
        />,
      )}
    </div>
  );
}
