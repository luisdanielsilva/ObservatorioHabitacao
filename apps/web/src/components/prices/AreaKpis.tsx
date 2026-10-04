import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/shared/HelpTip";
import type { Formatter } from "@/lib/format";
import type { AreaPrices } from "./data";

/** KPI cards: median sale, median rent, gross yield and annual change of the sale median. */
export async function AreaKpis({ prices, f }: { prices: AreaPrices; f: Formatter }) {
  const t = await getTranslations("prices");
  const { sale, rent, grossYield } = prices;
  const noData = <span className="text-muted-foreground">{t("noData")}</span>;

  const cards = [
    { key: "sale", label: t("salePerM2"), value: sale ? f.euroPerM2(sale.value) : noData },
    { key: "rent", label: t("rentPerM2"), value: rent ? f.euroPerM2(rent.value) : noData },
    {
      key: "yield",
      label: t("grossYield"),
      help: t("grossYieldHelp"),
      value: grossYield === null ? noData : f.percent(grossYield),
    },
    {
      key: "yoy",
      label: t("yearOnYear"),
      value: sale?.yearOnYear == null ? noData : f.signedPercent(sale.yearOnYear),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.key} className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle
              as="div"
              className="flex items-center gap-1 text-sm font-normal text-muted-foreground"
            >
              {c.label}
              {c.help && <HelpTip label={c.label} text={c.help} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold tabular-nums">{c.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
