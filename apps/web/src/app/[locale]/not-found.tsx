import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("notFoundText")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
