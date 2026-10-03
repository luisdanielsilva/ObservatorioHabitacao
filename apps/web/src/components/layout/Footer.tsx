import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";

export async function Footer() {
  const t = await getTranslations("footer");
  const links = [
    { href: "/sobre", label: t("about") },
    { href: "/metodologia", label: t("methodology") },
    { href: "/contactos", label: t("contacts") },
    { href: "/privacidade", label: t("privacy") },
    { href: "/termos", label: t("terms") },
    { href: "/cookies", label: t("cookies") },
  ] as const;

  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-sm text-muted-foreground">{t("disclaimer")}</p>
          <p className="text-sm text-muted-foreground">{t("apps")}</p>
          <p className="text-xs text-muted-foreground">{t("dataSources")}</p>
        </div>
        <nav aria-label={t("about")} className="flex flex-col gap-2 text-sm md:items-end">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {l.label}
            </Link>
          ))}
          <span className="pt-2 text-xs text-muted-foreground">
            {t("rights", { year: new Date().getFullYear() })}
          </span>
        </nav>
      </div>
    </footer>
  );
}
