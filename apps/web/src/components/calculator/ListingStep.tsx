"use client";

import { Link2, Loader2, MapPin, PencilLine, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import type { ReferenceResponse } from "@/app/api/reference/route";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaPicker, type AreaTree } from "@/components/shared/AreaPicker";
import { HelpTip } from "@/components/shared/HelpTip";
import { SyntheticBadge } from "@/components/shared/SyntheticBadge";
import { hasTypology, type PropertyField } from "@/lib/calculator/flow";
import { CONDITIONS, PROPERTY_TYPES, type CalculatorState } from "@/lib/calculator/state";
import { googleMapsUrl, mapsUrlForPoint } from "@/lib/mapsLink";
import { formatPeriod } from "@/lib/period";
import { useFormat } from "@/lib/useFormat";
import type { Update } from "./Calculator";
import { FieldLabel, focusFirstInvalid, MissingAlert, NumberField, SelectField } from "./fields";
import { withBasePath } from "@/lib/basePath";

type LinkStatus = "idle" | "reading" | Exclude<AnalyzeResponse["status"], "ok"> | "ok";

/**
 * Step 1: the property. The user pastes a listing link, which is read for them, or chooses to
 * fill in every field by hand. The fields appear once a link is read or manual entry is chosen.
 */
export function ListingStep({
  state,
  update,
  tree,
  reference,
  missing,
  autoRead = false,
  startManual = false,
  onContinue,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  tree: AreaTree;
  reference: ReferenceResponse | null;
  missing: PropertyField[];
  /** Read the link in the state as soon as the step mounts. */
  autoRead?: boolean;
  startManual?: boolean;
  onContinue: () => void;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>(autoRead ? "reading" : "idle");
  // Manual entry was asked for, or a saved scenario or draft already has property data.
  const [showFields, setShowFields] = useState(
    () =>
      startManual || state.askingPrice !== null || state.areaId !== null || state.areaM2 !== null,
  );

  function readLink() {
    setLinkStatus("reading");
    void analyze();
  }

  async function analyze() {
    try {
      const res = await fetch(withBasePath("/api/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.url.trim() }),
      });
      const body = (await res.json()) as AnalyzeResponse;
      if (body.status !== "ok") return setLinkStatus(body.status);
      const p = body.property;
      update({
        ...(p.propertyType && { propertyType: p.propertyType }),
        ...(p.bedrooms !== undefined && { bedrooms: p.bedrooms }),
        ...(p.areaM2 !== undefined && { areaM2: p.areaM2 }),
        ...(p.condition && { condition: p.condition }),
        ...(p.askingPrice !== undefined && { askingPrice: p.askingPrice }),
        ...(p.address && { address: p.address }),
        // Where the listing places the property, unless the user already gave a map link.
        ...(p.lat !== undefined &&
          p.lng !== undefined &&
          !state.mapsUrl.trim() && { mapsUrl: mapsUrlForPoint(p.lat, p.lng) }),
        ...(body.areaId && { areaId: body.areaId }),
        // The photos belong to this listing: a new link replaces them.
        listingPhotos: p.photos ?? [],
        extras: {
          garage: p.hasGarage ?? state.extras.garage,
          elevator: p.hasElevator ?? state.extras.elevator,
          balcony: p.hasBalcony ?? state.extras.balcony,
          pool: p.hasPool ?? state.extras.pool,
        },
      });
      setLinkStatus("ok");
      setShowFields(true);
    } catch {
      setLinkStatus("failed");
    }
  }

  const autoReadDone = useRef(false);
  useEffect(() => {
    if (!autoRead || autoReadDone.current) return;
    autoReadDone.current = true;
    void analyze();
    // Runs once, for the link the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkMessage = {
    idle: null,
    reading: t("readingHelp"),
    ok: t("linkRead"),
    not_allowed: t("linkNotAllowed"),
    not_listing: t("linkNotListing"),
    failed: t("linkFailed"),
    invalid: t("linkInvalid"),
    rate_limited: t("rateLimited"),
  }[linkStatus];

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-url`} className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t("linkLabel")}
        </Label>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (state.url.trim()) readLink();
          }}
        >
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            placeholder={t("linkPlaceholder")}
            value={state.url}
            onChange={(e) => update({ url: e.target.value })}
            aria-describedby={`${id}-url-help`}
          />
          <Button type="submit" disabled={!state.url.trim() || linkStatus === "reading"}>
            {linkStatus === "reading" ? <Loader2 className="animate-spin" /> : <Link2 />}
            {linkStatus === "reading" ? t("reading") : t("readLink")}
          </Button>
        </form>
        <p id={`${id}-url-help`} className="text-xs text-muted-foreground" aria-live="polite">
          {linkMessage ?? t("linkHelp")}
        </p>
      </div>

      {!showFields ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => setShowFields(true)}>
            <PencilLine />
            {t("manualEntry")}
          </Button>
        </div>
      ) : (
        <PropertyFields
          state={state}
          update={update}
          tree={tree}
          reference={reference}
          missing={missing}
          onContinue={onContinue}
          locale={locale}
        />
      )}
    </>
  );
}

function PropertyFields({
  state,
  update,
  tree,
  reference,
  missing,
  onContinue,
  locale,
}: {
  state: CalculatorState;
  update: Update;
  tree: AreaTree;
  reference: ReferenceResponse | null;
  missing: PropertyField[];
  onContinue: () => void;
  locale: string;
}) {
  const t = useTranslations("evaluate");
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [tried, setTried] = useState(false);
  const invalid = (field: PropertyField) => tried && missing.includes(field);

  return (
    <div ref={container} className="space-y-5 border-t pt-5">
      <p className="text-sm text-muted-foreground">{t("manualIntro")}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {t("location")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </legend>
        <AreaPicker
          tree={tree}
          value={state.areaId}
          onChange={(areaId) => update({ areaId })}
          invalid={invalid("areaId")}
        />
        <MapsLinkField value={state.mapsUrl} onChange={(mapsUrl) => update({ mapsUrl })} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t("askingPrice")}
          kind="money"
          required
          invalid={invalid("askingPrice")}
          value={state.askingPrice}
          onChange={(askingPrice) => update({ askingPrice })}
          locale={locale}
        />
        <NumberField
          label={t("areaM2")}
          kind="number"
          suffix="m²"
          required
          invalid={invalid("areaM2")}
          value={state.areaM2}
          onChange={(areaM2) => update({ areaM2 })}
          locale={locale}
        />
        <SelectField
          label={t("propertyType")}
          value={state.propertyType}
          options={PROPERTY_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
          onChange={(propertyType) => update({ propertyType })}
        />
        {hasTypology(state.propertyType) && (
          <SelectField
            label={t("typology")}
            required
            invalid={invalid("bedrooms")}
            value={state.bedrooms ?? -1}
            options={[
              { value: -1, label: t("selectPlaceholder") },
              ...[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "T5+" : `T${n}` })),
            ]}
            onChange={(n) => update({ bedrooms: n < 0 ? null : n })}
          />
        )}
        <SelectField
          label={t("condition")}
          value={state.condition}
          options={CONDITIONS.map((v) => ({ value: v, label: t(`conditions.${v}`) }))}
          onChange={(condition) => update({ condition })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("extras")}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(
            [
              ["garage", t("extraGarage")],
              ["elevator", t("extraElevator")],
              ["balcony", t("extraBalcony")],
              ["pool", t("extraPool")],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${key}`}
                checked={state.extras[key]}
                onCheckedChange={(c) => update({ extras: { ...state.extras, [key]: c === true } })}
              />
              <Label htmlFor={`${id}-${key}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={`${id}-address`}>{t("addressOptional")}</FieldLabel>
        <Input
          id={`${id}-address`}
          autoComplete="street-address"
          value={state.address}
          onChange={(e) => update({ address: e.target.value })}
        />
      </div>

      <MarketReference state={state} reference={reference} />

      {tried && missing.length > 0 && (
        <MissingAlert>
          {t("missing", { fields: missing.map((m) => t(`requiredFields.${m}`)).join(", ") })}
        </MissingAlert>
      )}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t("requiredNote")}</p>
        <Button
          onClick={() => {
            setTried(true);
            if (missing.length === 0) onContinue();
            else focusFirstInvalid(container.current);
          }}
          className="shrink-0"
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}

/** INE medians for the chosen area, compared with the asking price. */
export function MarketReference({
  state,
  reference,
}: {
  state: CalculatorState;
  reference: ReferenceResponse | null;
}) {
  const t = useTranslations("evaluate");
  const tc = useTranslations("common");
  const tp = useTranslations("prices");
  const f = useFormat();
  const period = (p: string) => formatPeriod((key, values) => tp(key, values), p);

  if (state.areaId === null) {
    return (
      <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t("chooseArea")}</p>
    );
  }
  if (!reference) return null;
  const { sale, rent } = reference;
  if (!sale && !rent) {
    return (
      <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t("noReference")}</p>
    );
  }

  const askingPerM2 = state.askingPrice && state.areaM2 ? state.askingPrice / state.areaM2 : null;
  const rentPerM2 = state.monthlyRent && state.areaM2 ? state.monthlyRent / state.areaM2 : null;
  const synthetic = sale?.synthetic || rent?.synthetic;

  return (
    <div className="space-y-3 rounded-lg bg-muted/50 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{t("marketReference")}</h3>
        <HelpTip label={t("marketReference")} text={t("marketReferenceHelp")} />
        {synthetic && <SyntheticBadge />}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {sale && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("medianSale")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{f.euroPerM2(sale.value)}</dd>
            <dd className="text-xs text-muted-foreground">
              {t("inArea", { area: sale.areaName })} · {period(sale.period)}
              {sale.yearOnYear !== null && (
                <> · {t("yoy", { value: f.signedPercent(sale.yearOnYear) })}</>
              )}
            </dd>
            {askingPerM2 && (
              <dd className="mt-1 text-sm">
                {t("askingPerM2", {
                  value: f.euro(askingPerM2),
                  diff: f.signedPercent(askingPerM2 / sale.value - 1, 0),
                })}
              </dd>
            )}
          </div>
        )}
        {rent && (
          <div>
            <dt className="text-xs text-muted-foreground">{t("medianRent")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{f.euroPerM2(rent.value)}</dd>
            <dd className="text-xs text-muted-foreground">
              {t("inArea", { area: rent.areaName })} · {period(rent.period)}
              {rent.yearOnYear !== null && (
                <> · {t("yoy", { value: f.signedPercent(rent.yearOnYear) })}</>
              )}
            </dd>
            {rentPerM2 && (
              <dd className="mt-1 text-sm">
                {t("rentPerM2", {
                  value: f.euroPerM2(rentPerM2).replace("/m²", ""),
                  diff: f.signedPercent(rentPerM2 / rent.value - 1, 0),
                })}
              </dd>
            )}
          </div>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">
        {tc("source", { source: synthetic ? tc("syntheticData") : "INE" })}
      </p>
    </div>
  );
}

/** Optional Google Maps link to the property, with a check and a link to open it. */
function MapsLinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("evaluate");
  const id = useId();
  const link = googleMapsUrl(value);
  const wrong = value.trim() !== "" && !link;
  return (
    <div className="space-y-1.5 pt-2">
      <FieldLabel htmlFor={`${id}-maps`}>{t("mapsUrl")}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={`${id}-maps`}
          type="url"
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          value={value}
          aria-invalid={wrong || undefined}
          aria-describedby={`${id}-maps-help`}
          onChange={(e) => onChange(e.target.value)}
        />
        {link && (
          <Button asChild variant="outline">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <MapPin />
              {t("openMaps")}
            </a>
          </Button>
        )}
      </div>
      <p
        id={`${id}-maps-help`}
        className={wrong ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
      >
        {wrong ? t("mapsUrlInvalid") : t("mapsUrlHelp")}
      </p>
    </div>
  );
}
