"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";

export interface PriceRow {
  id: number;
  name: string;
  path: string;
  sale: number | null;
  rent: number | null;
  grossYield: number | null;
  saleYoy: number | null;
}

type SortKey = "name" | "sale" | "rent" | "grossYield" | "saleYoy";

/** Sortable table of areas with their medians. Areas without data sort last. */
export function PriceTable({
  rows,
  caption,
  highlightId,
}: {
  rows: PriceRow[];
  caption: string;
  highlightId?: number;
}) {
  const t = useTranslations("prices");
  const f = useFormat();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const collator = new Intl.Collator("pt-PT");
    return [...rows].sort((a, b) => {
      if (sort.key === "name") {
        const c = collator.compare(a.name, b.name);
        return sort.dir === "asc" ? c : -c;
      }
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return collator.compare(a.name, b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sort]);

  const columns: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: "name", label: t("area"), numeric: false },
    { key: "sale", label: t("salePerM2"), numeric: true },
    { key: "rent", label: t("rentPerM2"), numeric: true },
    { key: "grossYield", label: t("grossYield"), numeric: true },
    { key: "saleYoy", label: t("yearOnYear"), numeric: true },
  ];

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const empty = <span className="text-muted-foreground">{t("noData")}</span>;

  return (
    <Table className="min-w-[36rem]">
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          {columns.map((c) => {
            const active = sort.key === c.key;
            const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <TableHead
                key={c.key}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                className={cn(c.numeric && "text-right")}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    c.numeric && "flex-row-reverse",
                  )}
                  aria-label={t("sortBy", { column: c.label })}
                >
                  {c.label}
                  <Icon className="size-3.5 opacity-60" aria-hidden />
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.id} data-state={r.id === highlightId ? "selected" : undefined}>
            <TableCell className="font-medium">
              <Link
                href={`/precos/${r.path}`}
                className="underline-offset-4 hover:text-primary hover:underline"
              >
                {r.name}
              </Link>
              {r.id === highlightId && (
                <Badge variant="secondary" className="ml-2">
                  {t("currentArea")}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.sale === null ? empty : f.euroPerM2(r.sale)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.rent === null ? empty : f.euroPerM2(r.rent)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.grossYield === null ? empty : f.percent(r.grossYield)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.saleYoy === null ? empty : f.signedPercent(r.saleYoy)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
