"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "Entrar" or "Conta", decided in the browser so that pages stay statically rendered
 * (reading the session on the server would make every page dynamic).
 */
export function AccountButton({ className }: { className?: string }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <Inner className={className} />
    </SessionProvider>
  );
}

function Inner({ className }: { className?: string }) {
  const t = useTranslations("signIn");
  const { status } = useSession();
  return (
    <Button asChild size="sm" variant="outline" className={className}>
      <Link href={status === "authenticated" ? "/conta" : "/entrar"}>
        {status === "authenticated" ? t("account") : t("title")}
      </Link>
    </Button>
  );
}
