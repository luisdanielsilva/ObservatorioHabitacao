import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  OTHER_QUESTIONS,
  type OtherQuestion,
  type ReceiptLine,
  type Text,
  type Visual,
} from "./otherQuestions";

type Lang = keyof Text;

/** "€ 3 420" in Portuguese, "€3,420" in English, as written in the examples. */
function euros(amount: number, lang: Lang) {
  const digits = String(Math.abs(amount)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    lang === "pt" ? " " : ",",
  );
  return `${amount < 0 ? "− " : ""}€${lang === "pt" ? " " : ""}${digits}`;
}

/** Where each card sits: 7 + 5, then 4 + 4 + 4, then 12 columns; on tablets, 1 and 6 span both. */
const SPANS: Record<string, string> = {
  pricey: "md:col-span-2 lg:col-span-7",
  strategy: "lg:col-span-5",
  costs: "lg:col-span-4",
  breakEven: "lg:col-span-4",
  gainTax: "lg:col-span-4",
  proceeds: "md:col-span-2 lg:col-span-12",
};
/** The two wide cards put their example beside the text once there is room. */
const SIDE_BY_SIDE: Record<string, string> = {
  pricey: "sm:grid sm:grid-cols-2 sm:gap-8",
  proceeds: "md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-center md:gap-12",
};

const TONES: Record<OtherQuestion["tone"], string> = {
  card: "bg-card",
  mint: "bg-mint-soft",
  sand: "bg-sand-soft/60",
  // The facts band's colours, in both themes.
  dark: "bg-pine-deep text-[#eaf2ec] ring-transparent",
};

/** The tool's name, always written: the colour is never the only sign of it. */
function ToolLabel({
  tool,
  dark,
  label,
}: {
  tool: OtherQuestion["tool"];
  dark: boolean;
  label: string;
}) {
  return (
    <Badge
      className={cn(
        "h-auto rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.14em] uppercase",
        dark
          ? "bg-brand-accent text-pine-deep"
          : tool === "sell"
            ? "bg-brand-accent/20 text-brand-accent-foreground"
            : "bg-mint text-primary",
      )}
    >
      {label}
    </Badge>
  );
}

/**
 * "Outras perguntas a que respondemos": a bento grid of the questions the site answers, each
 * with a small, illustrative example of the answer (cards and figures in `otherQuestions.ts`).
 * The cards are information only; the two buttons in the header are the section's actions.
 */
export async function OtherQuestions({ showSell }: { showSell: boolean }) {
  const t = await getTranslations("home.questions");
  const tn = await getTranslations("nav");
  const lang = ((await getLocale()) === "en" ? "en" : "pt") satisfies Lang;
  const cards = OTHER_QUESTIONS.filter((q) => showSell || q.tool !== "sell");

  return (
    <section aria-labelledby="questions" className="py-14">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 id="questions" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("text")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="lg" className="h-10 rounded-xl px-4">
            <Link href="/avaliar">
              {tn("evaluate")} <ArrowRight aria-hidden />
            </Link>
          </Button>
          {showSell && (
            <Button
              asChild
              size="lg"
              className="h-10 rounded-xl bg-brand-accent px-4 text-pine-deep hover:bg-[color-mix(in_oklch,var(--brand-accent),white_18%)]"
            >
              <Link href="/vender">
                {tn("sell")} <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-12">
        {cards.map((q) => {
          const dark = q.tone === "dark";
          return (
            <li key={q.key} className={cn("min-w-0", SPANS[q.key])}>
              <Card
                className={cn(
                  "h-full gap-6 rounded-3xl p-6 text-base ring-foreground/8 sm:p-7",
                  TONES[q.tone],
                  SIDE_BY_SIDE[q.key],
                )}
              >
                <div className="flex min-w-0 flex-col items-start gap-3">
                  <ToolLabel
                    tool={q.tool}
                    dark={dark}
                    label={q.tool === "sell" ? tn("sell") : tn("evaluate")}
                  />
                  <h3 className="text-lg leading-snug font-semibold text-balance">
                    {q.question[lang]}
                  </h3>
                  <p
                    className={cn("text-sm", dark ? "text-[#eaf2ec]/80" : "text-muted-foreground")}
                  >
                    {q.answer[lang]}
                  </p>
                </div>
                <div className="mt-auto min-w-0">
                  <Example visual={q.visual} lang={lang} />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Example({ visual: v, lang }: { visual: Visual; lang: Lang }) {
  switch (v.kind) {
    case "versus": {
      const above = Math.round((v.listing.perM2 / v.median.perM2 - 1) * 100);
      const rows = [
        { ...v.listing, width: 100, bar: "bg-brand-accent" },
        { ...v.median, width: (v.median.perM2 / v.listing.perM2) * 100, bar: "bg-primary" },
      ];
      return (
        <div className="space-y-3">
          <p className="flex justify-end">
            <span className="rounded-full bg-brand-accent/20 px-2.5 py-1 text-xs font-semibold text-brand-accent-foreground">
              {above > 0 ? "+" : ""}
              {above} % {v.versus[lang]}
            </span>
          </p>
          {rows.map((r) => (
            <div key={r.label.pt}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{r.label[lang]}</span>
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  {euros(r.perM2, lang)}/m²
                </span>
              </p>
              <div aria-hidden className="mt-1.5 h-2.5 rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", r.bar)}
                  style={{ width: `${r.width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "bars": {
      const colours = ["bg-primary", "bg-[#2f7a5e]", "bg-brand-accent", "bg-mint dark:bg-moss"];
      return (
        <div aria-hidden className="flex h-32 items-end gap-3">
          {v.bars.map((b, i) => (
            <div key={b.label.pt} className="flex h-full flex-1 flex-col justify-end gap-2">
              <div
                className={cn("rounded-t-xl rounded-b-sm", colours[i % colours.length])}
                style={{ height: `${b.height * 80}%` }}
              />
              <span className="truncate text-center text-xs text-muted-foreground">
                {b.label[lang]}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "receipt": {
      const line = (l: ReceiptLine) =>
        `${l.subtotal ? "= " : l.amount < 0 ? "− " : ""}${l.label[lang]}`;
      return (
        <dl className="space-y-1.5 text-sm">
          {v.lines.map((l) => (
            <div key={l.label.pt} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{line(l)}</dt>
              <dd className={cn("whitespace-nowrap tabular-nums", l.subtotal && "font-semibold")}>
                {euros(l.amount, lang)}
              </dd>
            </div>
          ))}
          <div
            className={cn(
              "flex items-baseline justify-between gap-3 border-t border-dashed border-foreground/25 pt-2 font-bold",
              v.totalIsSum ? "text-primary" : "text-brand-accent-foreground",
            )}
          >
            <dt>{v.total.label[lang]}</dt>
            <dd className="whitespace-nowrap tabular-nums">{euros(v.total.amount, lang)}</dd>
          </div>
        </dl>
      );
    }

    case "steps": {
      const tones = [
        "bg-mint text-primary",
        "bg-[#2f7a5e] text-white",
        "bg-primary text-primary-foreground",
      ];
      return (
        <ul className="flex h-36 items-end gap-2">
          {v.labels.map((label, i) => (
            <li key={label.pt} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
              {/* The block's height is the decoration; its amount is read as text. */}
              <div
                className={cn(
                  "flex items-start justify-center rounded-xl px-1 pt-2 text-xs font-semibold whitespace-nowrap tabular-nums sm:text-sm",
                  tones[i % tones.length],
                )}
                style={{ height: `${54 + i * 16}%` }}
              >
                {euros(Math.round(v.base * (1 + (i * v.step) / 100)), lang)}
              </div>
              <span className="text-center text-xs text-muted-foreground">{label[lang]}</span>
            </li>
          ))}
        </ul>
      );
    }

    case "split": {
      // Light colours of the site's palette, fixed so they read on the dark card in both themes.
      const parts = [
        { ...v.keep, colour: "bg-brand-accent" },
        ...v.deductions.map((d, i) => ({
          ...d,
          colour: ["bg-[#8cc4a8]", "bg-[#9cbf7a]", "bg-[#f2e8d3]"][i % 3],
        })),
      ];
      return (
        <div>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-[#eaf2ec]/80">{v.price.label[lang]}</span>
            <span className="text-xl font-bold tabular-nums">{euros(v.price.amount, lang)}</span>
          </p>
          <div aria-hidden className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-full">
            {parts.map((p) => (
              <div
                key={p.label.pt}
                className={p.colour}
                style={{ width: `${(p.amount / v.price.amount) * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {parts.map((p, i) => (
              <li
                key={p.label.pt}
                className={cn(
                  "flex items-center gap-2",
                  i === 0 ? "font-semibold text-brand-accent" : "text-[#eaf2ec]/85",
                )}
              >
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", p.colour)} />
                {p.label[lang]}
                <span className="tabular-nums">{euros(p.amount, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }
}
