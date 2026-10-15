"use client";

import { ExternalLink, Link2, Loader2, MapPin, PencilLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpTip } from "@/components/shared/HelpTip";
import { withBasePath } from "@/lib/basePath";
import {
  compareListings,
  siteName,
  type ComparableRow,
  type ComparablesSummary,
} from "@/lib/calculator/comparables";
import { hasTypology } from "@/lib/calculator/flow";
import {
  CONDITIONS,
  emptyComparable,
  MAX_COMPARABLES,
  MIN_COMPARABLES,
  PROPERTY_TYPES,
  type CalculatorState,
  type Comparable,
  type Condition,
} from "@/lib/calculator/state";
import { mapsUrlForPoint } from "@/lib/mapsLink";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import type { Update } from "./Calculator";
import { FieldLabel, NumberField, SelectField } from "./fields";

type Status =
  | "idle"
  | "reading"
  | "added"
  | "duplicate"
  | "same"
  | "full"
  | Exclude<AnalyzeResponse["status"], "ok">;

/**
 * Similar listings to compare the asking price with (Negócios semelhantes). The user pastes a
 * listing's link, which is read for them like the property's own, or adds one by hand for sites
 * that cannot be read; the details can be corrected. Later, listings found automatically fill
 * the same list.
 */
export function ComparablesSection({
  state,
  update,
  locationOf,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  /** "Parish, municipality" for an area id found by the link reader. */
  locationOf: (areaId: number) => string;
  locale: string;
}) {
  const t = useTranslations("comparables");
  const te = useTranslations("evaluate");
  const id = useId();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // The listing open for editing, by position.
  const [editing, setEditing] = useState<number | null>(null);
  const list = state.comparables;
  const full = list.length >= MAX_COMPARABLES;
  const summary = compareListings(state);

  const setList = (next: Comparable[]) => update({ comparables: next });
  const add = (c: Comparable, edit: boolean) => {
    setList([...list, c]);
    if (edit) setEditing(list.length);
  };

  async function read() {
    const link = url.trim();
    if (!link) return;
    if (full) return setStatus("full");
    if (sameListing(link, state.url)) return setStatus("same");
    if (list.some((c) => sameListing(link, c.url))) return setStatus("duplicate");
    setStatus("reading");
    try {
      const res = await fetch(withBasePath("/api/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const body = (await res.json()) as AnalyzeResponse;
      if (body.status !== "ok") return setStatus(body.status);
      const p = body.property;
      const location =
        (body.areaId !== null ? locationOf(body.areaId) : "") ||
        [p.parish, p.municipality].filter(Boolean).join(", ") ||
        (p.address ?? "");
      add(
        emptyComparable({
          url: link,
          propertyType: p.propertyType ?? state.propertyType,
          bedrooms: p.bedrooms ?? null,
          areaM2: p.areaM2 ?? null,
          condition: p.condition ?? null,
          askingPrice: p.askingPrice ?? null,
          location: location.slice(0, 200),
          mapsUrl: p.lat !== undefined && p.lng !== undefined ? mapsUrlForPoint(p.lat, p.lng) : "",
        }),
        // Open it when something the comparison needs is missing.
        !(p.askingPrice && p.areaM2),
      );
      setUrl("");
      setStatus("added");
    } catch {
      setStatus("failed");
    }
  }

  function addManual() {
    if (full) return setStatus("full");
    add(
      emptyComparable({
        url: url.trim(),
        propertyType: state.propertyType,
        bedrooms: state.bedrooms,
      }),
      true,
    );
    setUrl("");
    setStatus("idle");
  }

  const message = {
    idle: null,
    reading: te("readingHelp"),
    added: t("added"),
    duplicate: t("duplicate"),
    same: t("same"),
    full: t("full", { max: MAX_COMPARABLES }),
    not_allowed: te("linkNotAllowed"),
    not_listing: te("linkNotListing"),
    failed: te("linkFailed"),
    invalid: te("linkInvalid"),
    rate_limited: te("rateLimited"),
  }[status];

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 id={`${id}-title`} className="font-semibold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("intro", { min: MIN_COMPARABLES })}</p>
      </div>

      {list.length > 0 && <ComparablesSummaryBox summary={summary} />}

      {list.length > 0 && (
        <ol className="space-y-2">
          {summary.rows.map((row, i) => (
            <li key={i} className="rounded-md border p-3">
              <ComparableLine row={row} n={i + 1}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={editing === i}
                  aria-label={t("editLabel", { n: i + 1 })}
                  onClick={() => setEditing(editing === i ? null : i)}
                >
                  <PencilLine />
                  {editing === i ? t("done") : t("edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("removeLabel", { n: i + 1 })}
                  onClick={() => {
                    setList(list.filter((_, j) => j !== i));
                    setEditing(null);
                  }}
                >
                  <Trash2 />
                  {t("remove")}
                </Button>
              </ComparableLine>
              {editing === i && (
                <ComparableFields
                  value={list[i]!}
                  onChange={(c) => setList(list.map((old, j) => (j === i ? c : old)))}
                  locale={locale}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {!full && (
        <div className="space-y-2">
          <FieldLabel htmlFor={`${id}-url`}>{t("linkLabel")}</FieldLabel>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void read();
            }}
          >
            <Input
              id={`${id}-url`}
              type="url"
              inputMode="url"
              placeholder={te("linkPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-describedby={`${id}-url-help`}
            />
            <Button type="submit" disabled={!url.trim() || status === "reading"}>
              {status === "reading" ? <Loader2 className="animate-spin" /> : <Link2 />}
              {status === "reading" ? t("reading") : t("add")}
            </Button>
            <Button type="button" variant="outline" onClick={addManual}>
              <Plus />
              {t("addManual")}
            </Button>
          </form>
          <p id={`${id}-url-help`} className="text-xs text-muted-foreground" aria-live="polite">
            {message ?? t("linkHelp")}
          </p>
        </div>
      )}
      {full && (
        <p className="text-xs text-muted-foreground">{t("full", { max: MAX_COMPARABLES })}</p>
      )}
    </section>
  );
}

/** The verdict and the figures it comes from: median, range, and this property at the median. */
export function ComparablesSummaryBox({ summary }: { summary: ComparablesSummary }) {
  const t = useTranslations("comparables");
  const f = useFormat();
  const { opportunity } = summary;
  return (
    <div className="space-y-3 rounded-lg bg-muted/50 p-4" aria-live="polite">
      {opportunity && !summary.tooFew && (
        <div className="space-y-1">
          <Badge
            className={cn(
              opportunity.signal === "opportunity" && "bg-positive text-background",
              opportunity.signal === "fair" && "bg-secondary text-secondary-foreground",
              opportunity.signal === "above" && "bg-destructive text-white",
            )}
          >
            {t(`verdict.${opportunity.signal}`)}
          </Badge>
          <p className="text-sm">
            {t("verdictText", {
              diff: f.signedPercent(opportunity.difference),
              count: summary.count,
              dearer: summary.dearer,
            })}
          </p>
        </div>
      )}
      {summary.tooFew && (
        <p className="text-sm font-medium">
          {t("tooFew", { count: summary.count, min: MIN_COMPARABLES })}
        </p>
      )}
      {summary.medianPerM2 !== null && (
        <dl className="grid gap-3 sm:grid-cols-4">
          <Figure
            label={t("columns.perM2")}
            value={summary.pricePerM2}
            sub={t("thisProperty")}
            f={f}
            perM2
          />
          <Figure label={t("medianPerM2")} value={summary.medianPerM2} f={f} perM2 />
          <div>
            <dt className="text-xs text-muted-foreground">{t("range")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {f.number(Math.round(summary.minPerM2!))}–{f.euroPerM2(summary.maxPerM2!)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {t("valueAtMedian")}
              <HelpTip label={t("valueAtMedian")} text={t("valueAtMedianHelp")} />
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.valueAtMedian !== null ? f.euro(summary.valueAtMedian) : "—"}
            </dd>
          </div>
        </dl>
      )}
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  f,
  perM2,
}: {
  label: string;
  value: number | null;
  sub?: string;
  f: ReturnType<typeof useFormat>;
  perM2?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">
        {label}
        {sub && ` · ${sub}`}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">
        {value === null ? "—" : perM2 ? f.euroPerM2(value) : f.euro(value)}
      </dd>
    </div>
  );
}

/**
 * One similar listing on a line: what it is, where, its price and €/m², how this property
 * compares, and links to the listing and the map. Values that set it apart are marked.
 */
export function ComparableLine({
  row,
  n,
  children,
}: {
  row: ComparableRow;
  n: number;
  /** Actions, e.g. edit and remove. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("comparables");
  const te = useTranslations("evaluate");
  const f = useFormat();
  const c = row.comparable;
  const differs = (d: ComparableRow["differences"][number]) => row.differences.includes(d);
  const mark = (on: boolean, text: string) =>
    on ? (
      <span className="text-amber-700 dark:text-amber-400" title={t("different")}>
        {text}*
      </span>
    ) : (
      text
    );
  const typology =
    hasTypology(c.propertyType) && c.bedrooms !== null
      ? ` T${c.bedrooms === 5 ? "5+" : c.bedrooms}`
      : "";
  const parts = [
    mark(differs("type") || differs("bedrooms"), `${te(`types.${c.propertyType}`)}${typology}`),
    c.areaM2 !== null ? mark(differs("area"), `${f.number(c.areaM2)} m²`) : null,
    c.condition ? mark(differs("condition"), te(`conditions.${c.condition}`)) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">
          <span className="text-muted-foreground">{t("similar", { n })} · </span>
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {p}
            </span>
          ))}
        </p>
        <p className="text-sm tabular-nums">
          {c.askingPrice !== null ? f.euro(c.askingPrice) : "—"}
          {row.pricePerM2 !== null && (
            <span className="text-muted-foreground"> · {f.euroPerM2(row.pricePerM2)}</span>
          )}
          {row.difference !== null && (
            <span
              className={cn(
                "ml-2 text-xs font-medium",
                row.difference < 0 ? "text-positive" : row.difference > 0 && "text-destructive",
              )}
              title={t("vsThisHelp")}
            >
              {t("columns.vsThis")} {f.signedPercent(row.difference, 0)}
            </span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {c.location && <span>{c.location}</span>}
          {row.distanceKm !== null && (
            <span>{t("km", { value: f.number(row.distanceKm, row.distanceKm < 10 ? 1 : 0) })}</span>
          )}
          {row.listingUrl && (
            <a
              href={row.listingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden />
              {t("openListing")} ({siteName(row.listingUrl)})
            </a>
          )}
          {row.mapsUrl && (
            <a
              href={row.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              <MapPin className="size-3" aria-hidden />
              {t("openMap")}
            </a>
          )}
        </p>
      </div>
      {children && <div className="flex shrink-0 gap-1">{children}</div>}
    </div>
  );
}

/** A similar listing's details, to correct what the link reader found or to type them in. */
function ComparableFields({
  value,
  onChange,
  locale,
}: {
  value: Comparable;
  onChange: (c: Comparable) => void;
  locale: string;
}) {
  const t = useTranslations("comparables");
  const te = useTranslations("evaluate");
  const id = useId();
  const set = (patch: Partial<Comparable>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2">
      <NumberField
        label={te("askingPrice")}
        kind="money"
        value={value.askingPrice}
        onChange={(askingPrice) => set({ askingPrice })}
        locale={locale}
      />
      <NumberField
        label={te("areaM2")}
        kind="number"
        suffix="m²"
        value={value.areaM2}
        onChange={(areaM2) => set({ areaM2 })}
        locale={locale}
      />
      <SelectField
        label={te("propertyType")}
        value={value.propertyType}
        options={PROPERTY_TYPES.map((v) => ({ value: v, label: te(`types.${v}`) }))}
        onChange={(propertyType) => set({ propertyType })}
      />
      {hasTypology(value.propertyType) && (
        <SelectField
          label={te("typology")}
          value={value.bedrooms ?? -1}
          options={[
            { value: -1, label: te("selectPlaceholder") },
            ...[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "T5+" : `T${n}` })),
          ]}
          onChange={(n) => set({ bedrooms: n < 0 ? null : n })}
        />
      )}
      <SelectField<Condition | "">
        label={te("condition")}
        value={value.condition ?? ""}
        options={[
          { value: "", label: t("conditionUnknown") },
          ...CONDITIONS.map((v) => ({ value: v, label: te(`conditions.${v}`) })),
        ]}
        onChange={(condition) => set({ condition: condition || null })}
      />
      <div className="space-y-1.5">
        <FieldLabel htmlFor={`${id}-location`}>{t("location")}</FieldLabel>
        <Input
          id={`${id}-location`}
          placeholder={t("locationPlaceholder")}
          maxLength={200}
          value={value.location}
          onChange={(e) => set({ location: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={`${id}-url`}>{t("url")}</FieldLabel>
        <Input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          maxLength={2000}
          value={value.url}
          onChange={(e) => set({ url: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={`${id}-maps`}>{t("mapsUrl")}</FieldLabel>
        <Input
          id={`${id}-maps`}
          type="url"
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          maxLength={2000}
          value={value.mapsUrl}
          aria-describedby={`${id}-maps-help`}
          onChange={(e) => set({ mapsUrl: e.target.value })}
        />
        <p id={`${id}-maps-help`} className="text-xs text-muted-foreground">
          {t("mapsUrlHelp")}
        </p>
      </div>
    </div>
  );
}

/** The same listing, ignoring the scheme, "www.", a trailing slash, the query and the hash. */
function sameListing(a: string, b: string): boolean {
  const key = (s: string) => {
    try {
      const u = new URL(s.trim());
      return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
    } catch {
      return null;
    }
  };
  const ka = key(a);
  return ka !== null && ka === key(b);
}

/** The similar listings as the user left them, read-only (on the shared page). */
export function SharedComparables({ state }: { state: CalculatorState }) {
  const t = useTranslations("comparables");
  const summary = compareListings(state);
  return (
    <section aria-labelledby="semelhantes" className="space-y-3">
      <h2 id="semelhantes" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ComparablesSummaryBox summary={summary} />
      <ol className="space-y-2">
        {summary.rows.map((row, i) => (
          <li key={i} className="rounded-md border p-3">
            <ComparableLine row={row} n={i + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}
