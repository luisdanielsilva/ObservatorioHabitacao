import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";

export async function Footer() {
  const t = await getTranslations("footer");
  const links = [
    { href: "/sobre", label: t("about") },
    { href: "/metodologia", label: t("methodology") },
    { href: "/contactos", label: t("contacts") },
    { href: "/#apoiar", label: t("donate") },
    { href: "/privacidade", label: t("privacy") },
    { href: "/termos", label: t("terms") },
    { href: "/cookies", label: t("cookies") },
  ] as const;

  return (
    <footer className="mt-16 bg-pine-deep text-[#d7e3db]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-11 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Logo onDark />
          <p className="max-w-md text-sm">{t("disclaimer")}</p>
          <p className="text-xs opacity-75">{t("dataSources")}</p>
        </div>
        <nav aria-label={t("about")} className="flex flex-col gap-2 text-sm md:items-end">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-sm underline-offset-4 hover:text-brand-accent hover:underline focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-none"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-4 text-xs opacity-70">
          <span>{t("rights", { year: new Date().getFullYear() })}</span>
          <span>{t("apps")}</span>
        </div>
      </div>
    </footer>
  );
}
