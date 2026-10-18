import { Coffee } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DonateWidget } from "./DonateWidget";

/** "Apoiar" (issue #1): an optional donation, as on Portfolio Tracker but in Portuguese. */
export async function DonateSection() {
  const t = await getTranslations("donate");
  return (
    <section
      id="apoiar"
      aria-labelledby="donate"
      className="mb-14 grid scroll-mt-24 gap-6 rounded-2xl border bg-sand-soft/50 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center"
    >
      <div className="min-w-0">
        <h2 id="donate" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Coffee className="size-5 text-brand-accent-foreground" aria-hidden />
          {t("title")}
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {t.rich("text", { b: (chunks) => <b className="text-foreground">{chunks}</b> })}
        </p>
        <p className="mt-3 max-w-xl text-xs text-muted-foreground">{t("note")}</p>
      </div>
      <div className="w-full md:w-80">
        <DonateWidget />
      </div>
    </section>
  );
}
