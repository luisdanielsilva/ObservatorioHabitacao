import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Disclaimer({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Alert className={className}>
      <Info />
      <AlertTitle>{t("disclaimerTitle")}</AlertTitle>
      <AlertDescription>{t("disclaimer")}</AlertDescription>
    </Alert>
  );
}
