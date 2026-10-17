import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/navigation";
import { asLocale, initPageLocale } from "@/i18n/locale";

type Section = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** Paragraphs after the list. */
  after?: string[];
  /** The table of purposes and legal bases goes before the paragraphs. */
  table?: boolean;
};
type Purpose = { purpose: string; data: string; basis: string };

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacidade">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "legal" });
  return { title: t("privacyTitle") };
}

/**
 * Privacy policy (RGPD art. 13): a generic policy for the free accounts of issue #7. The
 * bracketed placeholders (controller, contact email, hosting provider) are to be filled in
 * before launch.
 */
export default async function Page({ params }: PageProps<"/[locale]/privacidade">) {
  await initPageLocale(params);
  const t = await getTranslations("legal");
  const tp = await getTranslations("privacy");
  const sections = tp.raw("sections") as Section[];
  const purposes = tp.raw("purposes") as Purpose[];
  const p = (text: string) => (
    <p key={text} className="leading-relaxed text-muted-foreground">
      {text}
    </p>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={t("privacyTitle")} />
      <p className="mb-2 text-sm text-warning">{t("draft")}</p>
      <p className="mb-6 text-sm text-muted-foreground">{tp("updated")}</p>
      <p className="leading-relaxed">{tp("intro")}</p>

      <nav aria-label={t("privacyTitle")} className="mt-8 rounded-xl bg-muted/60 p-4 text-sm">
        <ol className="grid list-decimal gap-1 pl-5 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} aria-labelledby={s.id} className="space-y-3">
            <h2 id={s.id} className="scroll-mt-24 text-xl font-semibold tracking-tight">
              {i + 1}. {s.title}
            </h2>
            {s.table && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {(["purpose", "data", "basis"] as const).map((k) => (
                        <th key={k} scope="col" className="px-3 py-2 font-semibold">
                          {tp(`purposeHead.${k}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purposes.map((row) => (
                      <tr key={row.purpose} className="align-top">
                        <td className="px-3 py-2">{row.purpose}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.data}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.paragraphs?.map(p)}
            {s.items && (
              <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {s.after?.map(p)}
            {s.id === "cookies" && (
              <p>
                <Link href="/cookies" className="text-sm font-medium text-primary underline">
                  {t("cookiesTitle")}
                </Link>
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
