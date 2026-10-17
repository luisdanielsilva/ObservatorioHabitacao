"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ProfileFields } from "@/components/shared/ProfileFields";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileForm({
  voltar,
  name,
  phone,
  birthDate,
}: {
  voltar: string;
  name: string;
  phone: string;
  birthDate: string;
}) {
  const t = useTranslations("profile");
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {
    errors: [],
  });
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="voltar" value={voltar} />
      <ProfileFields
        key={JSON.stringify(state)}
        errors={state.errors}
        defaults={state.values ?? { name, phone, birthDate }}
        autoFocus
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.rich("notice", {
          link: (chunks) => (
            <Link
              href="/privacidade"
              target="_blank"
              className="font-medium text-primary underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
