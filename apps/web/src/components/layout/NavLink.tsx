"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  mobile,
  children,
}: {
  href: ComponentProps<typeof Link>["href"] & string;
  mobile?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-mint font-semibold text-pine-deep dark:text-primary"
          : "text-muted-foreground hover:bg-mint-soft hover:text-primary",
        mobile && "text-base",
      )}
    >
      {children}
    </Link>
  );
}
