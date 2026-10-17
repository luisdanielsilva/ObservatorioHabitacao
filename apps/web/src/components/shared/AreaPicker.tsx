"use client";

import type { AreaNode } from "@observatorio-habitacao/db";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Label } from "@/components/ui/label";

export type AreaTree = AreaNode[];

/** Finds the chain of nodes from the root to the area with `id`. */
export function findAreaChain(tree: AreaTree, id: number | null): AreaNode[] {
  if (id === null) return [];
  for (const node of tree) {
    if (node.id === id) return [node];
    const chain = findAreaChain(node.children, id);
    if (chain.length) return [node, ...chain];
  }
  return [];
}

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-popover aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20";

/** District → municipality → parish selects. The value is the most specific area chosen. */
export function AreaPicker({
  tree,
  value,
  onChange,
  invalid = false,
}: {
  tree: AreaTree;
  value: number | null;
  onChange: (areaId: number | null) => void;
  /** Marks the first level still to choose (district, then municipality) as invalid. */
  invalid?: boolean;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const [district, municipality, parish] = findAreaChain(tree, value);

  const levels = [
    { key: "district", label: t("district"), options: tree, selected: district, parent: null },
    {
      key: "municipality",
      label: t("municipality"),
      options: district?.children ?? [],
      selected: municipality,
      parent: district,
    },
    {
      key: "parish",
      label: t("parish"),
      options: municipality?.children ?? [],
      selected: parish,
      parent: municipality,
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {levels.map((level) => (
        <div key={level.key} className="space-y-1.5">
          <Label htmlFor={`${id}-${level.key}`}>{level.label}</Label>
          <select
            id={`${id}-${level.key}`}
            className={selectClass}
            aria-invalid={
              invalid && level.key === (district ? "municipality" : "district") && !level.selected
                ? true
                : undefined
            }
            value={level.selected?.id ?? ""}
            disabled={level.options.length === 0}
            onChange={(e) =>
              onChange(e.target.value ? Number(e.target.value) : (level.parent?.id ?? null))
            }
          >
            <option value="">{level.parent ? t("any") : t("selectPlaceholder")}</option>
            {level.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
