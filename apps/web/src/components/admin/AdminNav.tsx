"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/parametros", key: "parameters" },
  { href: "/admin/pedidos", key: "leads" },
  { href: "/admin/importacoes", key: "imports" },
  { href: "/admin/utilizadores", key: "users" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  return (
    <nav aria-label={t("title")} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {SECTIONS.map(({ href, key }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
