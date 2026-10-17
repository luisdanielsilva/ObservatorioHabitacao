import { Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";
import { AccountButton } from "./AccountButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const t = await getTranslations("nav");
  const links = [
    { href: "/avaliar", label: t("evaluate") },
    ...(FEATURES.sell ? [{ href: "/vender", label: t("sell") }] : []),
    ...(FEATURES.prices ? [{ href: "/precos", label: t("prices") }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          aria-label={t("home")}
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>

        <nav aria-label={t("menu")} className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <AccountButton className="ml-1 hidden sm:inline-flex" />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("menu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="px-4 pt-4">
                <Logo />
              </SheetTitle>
              <nav aria-label={t("menu")} className="flex flex-col gap-1 p-4">
                {[...links, { href: "/entrar", label: t("signIn") } as const].map((l) => (
                  <NavLink key={l.href} href={l.href} mobile>
                    {l.label}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
