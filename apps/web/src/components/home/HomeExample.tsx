import { ArrowRight, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createFormatter } from "@/lib/format";

/**
 * A fixed Vender result for the home page: the T2 of 100 m² in Arroios from the e2e tests and
 * the screenshots, valued with 3 similar listings and sold with a loan of 100 000 € to repay.
 * It illustrates the result's layout; it is not recalculated.
 */
const EXAMPLE = {
  likely: 400_000,
  low: 360_000,
  high: 440_000,
  asking: 420_000,
  perM2: 3997,
  commission: 24_600,
  irs: 22_100,
  loan: 100_000,
  earlyRepayment: 500,
  // INE sale median in Arroios (€/m²), quarterly from Q1 2024 to Q1 2026.
  series: [4400, 4335, 4310, 4270, 4190, 4215, 4330, 4520, 4776],
  yearOnYear: 0.14,
};

export async function HomeExample() {
  const t = await getTranslations("home.example");
  const ts = await getTranslations("sell");
  const f = createFormatter(await getLocale());
  const e = EXAMPLE;
  const bank = e.loan + e.earlyRepayment;
  const net = e.likely - e.commission - e.irs - bank;
  const minus = (v: number) => `− ${f.euro(v)}`;
  const split = [
    { key: "you", value: net, color: "bg-primary" },
    { key: "bank", value: bank, color: "bg-chart-1/45" },
    { key: "commission", value: e.commission, color: "bg-brand-accent" },
    { key: "irs", value: e.irs, color: "bg-brand-accent-foreground" },
  ] as const;

  return (
    <section aria-labelledby="example" className="bg-mint-soft py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="example" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("text")}</p>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0 rounded-2xl border bg-background p-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {ts("likelyValue")}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-accent-foreground">
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {ts("confidence.medium")}
              </span>
            </div>
            <p className="mt-1 text-4xl font-bold tracking-tight text-pine-deep tabular-nums sm:text-5xl dark:text-foreground">
              {f.euro(e.likely)}
            </p>

            <div
              className="mt-4"
              role="img"
              aria-label={t("range", {
                low: f.euro(e.low),
                high: f.euro(e.high),
                likely: f.euro(e.likely),
              })}
            >
              <div className="relative h-3 rounded-full bg-secondary">
                <div className="absolute inset-y-0 right-[12%] left-[12%] rounded-full bg-linear-to-r from-brand-accent via-[#2f7a5e] to-brand-accent" />
                <div className="absolute top-1/2 left-1/2 size-5.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-pine-deep bg-background dark:border-primary" />
              </div>
              <div
                className="mt-2 flex justify-between px-[8%] text-sm text-muted-foreground tabular-nums"
                aria-hidden
              >
                <span>{f.euro(e.low)}</span>
                <span className="font-semibold text-foreground">{f.euro(e.likely)}</span>
                <span>{f.euro(e.high)}</span>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-sand-soft px-4 py-3">
                <dt className="text-xs text-brand-accent-foreground">{ts("askingPrice")}</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums">{f.euro(e.asking)}</dd>
              </div>
              <div className="rounded-xl bg-mint px-4 py-3">
                <dt className="text-xs text-primary">{ts("perM2")}</dt>
                <dd className="mt-0.5 text-lg font-bold text-pine-deep tabular-nums dark:text-foreground">
                  {f.euroPerM2(e.perM2)}
                </dd>
              </div>
            </dl>

            <Sparkline
              series={e.series}
              label={t("trend")}
              value={t("trendValue", {
                value: f.euroPerM2(e.series.at(-1)!),
                change: f.signedPercent(e.yearOnYear, 0),
              })}
              from={t("from")}
              to={t("to")}
            />
          </div>

          <div className="min-w-0 rounded-2xl border bg-background p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Wallet className="size-5 text-primary" aria-hidden />
              {ts("proceedsTitle")}
            </h3>
            <div
              className="mt-4 flex h-2.5 overflow-hidden rounded-full"
              role="img"
              aria-label={t("split", {
                total: f.euro(e.likely),
                you: f.euro(net),
                bank: f.euro(bank),
                commission: f.euro(e.commission),
                irs: f.euro(e.irs),
              })}
            >
              {split.map((s) => (
                <span
                  key={s.key}
                  className={s.color}
                  style={{ width: `${(s.value / e.likely) * 100}%` }}
                />
              ))}
            </div>
            <ul
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
              aria-hidden
            >
              {split.map((s) => (
                <li key={s.key} className="inline-flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-[3px] ${s.color}`} />
                  {t(`legend.${s.key}`)}
                </li>
              ))}
            </ul>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">{ts("proceedsTitle")}</caption>
              <tbody>
                <Row label={ts("netSalePrice")} value={f.euro(e.likely)} />
                <Row
                  label={ts("netCommission", { rate: f.percent(0.05, 1), vat: f.percent(0.23, 0) })}
                  value={minus(e.commission)}
                  negative
                />
                <Row label={ts("netIrs")} value={minus(e.irs)} negative />
                <Row label={ts("netLoan")} value={minus(e.loan)} negative />
                <Row label={ts("netEarlyRepayment")} value={minus(e.earlyRepayment)} negative />
                <tr className="bg-primary font-bold text-primary-foreground">
                  <th scope="row" className="rounded-l-lg px-3 py-3 text-left">
                    {ts("netTotal")}
                  </th>
                  <td className="rounded-r-lg px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    {f.euro(net)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">{ts("proceedsNote")}</p>
            <Link
              href="/vender"
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary underline decoration-brand-accent decoration-2 underline-offset-4 hover:decoration-primary"
            >
              {t("cta")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <tr className="border-b">
      <th scope="row" className="py-2.5 pr-4 text-left font-normal">
        {label}
      </th>
      <td
        className={`py-2.5 text-right whitespace-nowrap tabular-nums ${negative ? "text-[#9a4a2b] dark:text-[#e8a587]" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}

/** The INE median's two years as a line, with its last value marked in sand. */
function Sparkline({
  series,
  label,
  value,
  from,
  to,
}: {
  series: readonly number[];
  label: string;
  value: string;
  from: string;
  to: string;
}) {
  const w = 280;
  const h = 72;
  const pad = 6;
  const lo = Math.min(...series) - 90;
  const hi = Math.max(...series) + 24;
  const pts = series.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (series.length - 1),
    pad + ((hi - v) * (h - 2 * pad)) / (hi - lo),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts.at(-1)!;
  return (
    <figure className="mt-5">
      <figcaption className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-primary">{value}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1.5 block h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="home-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${pad},${h} ${line} ${lx.toFixed(1)},${h}`} fill="url(#home-spark)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={lx}
          cy={ly}
          r="4.5"
          fill="var(--brand-accent)"
          stroke="var(--background)"
          strokeWidth="2"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </figure>
  );
}
