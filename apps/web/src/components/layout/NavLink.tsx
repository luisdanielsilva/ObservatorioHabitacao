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
        "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "text-primary" : "text-muted-foreground",
        mobile && "text-base",
      )}
    >
      {children}
    </Link>
  );
}
