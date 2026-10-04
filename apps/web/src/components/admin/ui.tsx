import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A headline figure on the admin dashboard. */
export function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail?: React.ReactNode;
}) {
  return (
    <Card className="gap-1">
      <CardHeader>
        <CardTitle as="div" className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

/** Wide tables scroll inside their own box, never the page. */
export function TableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto rounded-lg border", className)}>
      <table className="w-full min-w-[36rem] text-sm">{children}</table>
    </div>
  );
}

export const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
export const td = "border-t px-3 py-2 align-top";

/** "2026-10-03 12:00:00" (SQLite UTC) → local date and time. */
export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(`${value.replace(" ", "T")}${value.includes("Z") ? "" : "Z"}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  });
}
