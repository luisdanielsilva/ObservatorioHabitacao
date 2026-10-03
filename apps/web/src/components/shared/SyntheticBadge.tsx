import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/** Marks placeholder (non-INE) data, so it is never mistaken for real statistics. */
export function SyntheticBadge() {
  const t = useTranslations("common");
  return (
    <Badge variant="outline" className="border-warning text-warning" title={t("syntheticDataHelp")}>
      {t("syntheticData")}
    </Badge>
  );
}
