"use client";

import { ImageOff, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { SaveResult } from "@/app/[locale]/avaliar/actions";
import type {
  PhotoInfo,
  PhotosResponse,
  UploadResponse,
} from "@/app/api/scenarios/[id]/photos/route";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/i18n/navigation";
import { fitsLimits, MAX_SIDE, preparePhoto, type PreparedPhoto } from "@/lib/photoPrepare";
import { useFormat } from "@/lib/useFormat";
import { cn } from "@/lib/utils";
import { signInToSaveHref } from "./SaveBar";

/** As PHOTO_LIMITS on the server; replaced by the server's values once the photos are loaded. */
const DEFAULT_LIMITS = { maxCount: 30, maxBytes: 5 * 1024 * 1024 };

/** A photo picked for upload, with its preview and whether the user keeps it selected. */
interface Pick extends PreparedPhoto {
  key: string;
  preview: string | null;
  selected: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "signinToUpload" }
  | { kind: "preparing"; done: number; total: number }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "message"; text: string; error?: boolean };

/**
 * Photos of the property: up to 30 photos or 5 MB per scenario. Picked photos are reduced in the
 * browser and shown for review; the user chooses which to send. Sending saves the evaluation
 * first if needed (photos belong to a saved scenario).
 */
export function PhotosSection({
  scenarioId,
  ensureSaved,
}: {
  scenarioId: number | null;
  /** Saves the evaluation as on screen, unless it already is. */
  ensureSaved: () => Promise<SaveResult>;
}) {
  const t = useTranslations("photos");
  const te = useTranslations("evaluate");
  const locale = useLocale();
  const f = useFormat();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [status, setStatus] = useState<Status>({ kind: scenarioId ? "loading" : "idle" });
  const [picks, setPicks] = useState<Pick[]>([]);

  // The scenario's photos, when it is opened or becomes another one (a copy). A scenario created
  // here to upload photos starts without any, so it is not loaded.
  const loadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!scenarioId || loadedFor.current === scenarioId) return;
    loadedFor.current = scenarioId;
    let current = true;
    fetch(`/api/scenarios/${scenarioId}/photos`)
      .then(async (res) => {
        if (!current) return;
        if (res.status === 401) return setStatus({ kind: "signin" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as PhotosResponse;
        if (!current) return;
        setPhotos(body.photos);
        setLimits(body.limits);
        setStatus({ kind: "idle" });
      })
      .catch(() => current && setStatus({ kind: "message", text: t("loadError"), error: true }));
    return () => {
      current = false;
      // Cancelled before it finished (e.g. React's double effects in development): load again.
      if (loadedFor.current === scenarioId) loadedFor.current = null;
    };
  }, [scenarioId, t]);

  // Previews are object URLs: released when their photo leaves the review.
  const previews = useRef(new Set<string>());
  const release = (list: Pick[]) =>
    list.forEach((p) => {
      if (p.preview) {
        URL.revokeObjectURL(p.preview);
        previews.current.delete(p.preview);
      }
    });
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const usage = {
    count: photos.length,
    bytes: photos.reduce((sum, p) => sum + p.bytes, 0),
  };
  const selected = picks.filter((p) => p.selected);
  const fits = fitsLimits(
    selected.map((p) => ({ bytes: p.blob.size })),
    usage,
    limits,
  );
  const full = usage.count >= limits.maxCount || usage.bytes >= limits.maxBytes;
  const busy = status.kind === "preparing" || status.kind === "uploading";

  const size = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${f.number(Math.max(1, Math.round(bytes / 1024)))}\u00a0kB`
      : `${f.number(bytes / 1024 / 1024, 1)}\u00a0MB`;

  async function choose(files: FileList) {
    const list = [...files];
    if (input.current) input.current.value = "";
    if (list.length === 0) return;
    const prepared: Pick[] = [];
    for (const [i, file] of list.entries()) {
      setStatus({ kind: "preparing", done: i, total: list.length });
      const photo = await preparePhoto(file);
      const preview = photo.readable ? URL.createObjectURL(photo.blob) : null;
      if (preview) previews.current.add(preview);
      prepared.push({
        ...photo,
        key: `${Date.now()}-${i}-${file.name}`,
        preview,
        selected: !photo.tooLarge,
      });
    }
    setPicks((current) => [...current, ...prepared]);
    setStatus({ kind: "idle" });
  }

  function cancel() {
    release(picks);
    setPicks([]);
    setStatus({ kind: "idle" });
  }

  async function upload() {
    if (selected.length === 0 || !fits) return;
    setStatus({ kind: "uploading", done: 0, total: selected.length });
    const saved = await ensureSaved();
    if (saved.status === "signin") return setStatus({ kind: "signinToUpload" });
    if (saved.status !== "saved") {
      return setStatus({
        kind: "message",
        text: saved.status === "limit" ? te("limitReached") : te("saveError"),
        error: true,
      });
    }
    if (saved.id !== scenarioId) {
      loadedFor.current = saved.id;
      setPhotos([]);
    }

    let added = 0;
    let stop: string | null = null;
    const sent: Pick[] = [];
    for (const [i, pick] of selected.entries()) {
      setStatus({ kind: "uploading", done: i, total: selected.length });
      const form = new FormData();
      form.append("file", pick.blob, pick.name);
      const res = await fetch(`/api/scenarios/${saved.id}/photos`, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({ status: "invalid" }))) as UploadResponse;
      sent.push(pick);
      if (body.status === "added") {
        added++;
        setPhotos((current) => [...current, body.photo]);
        continue;
      }
      if (body.status === "invalid") continue; // skip this file, go on with the others
      sent.pop();
      stop = t(`errors.${body.status}`);
      break;
    }
    // What was sent leaves the review; what was not (after a stop) stays to try again.
    release(sent);
    setPicks((current) => current.filter((p) => !sent.includes(p)));
    setStatus({
      kind: "message",
      text: stop ?? t("added", { count: added, skipped: sent.length - added }),
      error: stop !== null || added < sent.length,
    });
  }

  async function remove(photo: PhotoInfo) {
    const res = await fetch(photo.url, { method: "DELETE" });
    if (!res.ok) return setStatus({ kind: "message", text: t("deleteError"), error: true });
    setPhotos((current) => current.filter((p) => p.id !== photo.id));
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id={`${id}-title`} className="font-semibold">
            {t("title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {scenarioId && status.kind !== "loading" && status.kind !== "signin"
              ? t("usage", {
                  count: usage.count,
                  maxCount: limits.maxCount,
                  size: f.number(usage.bytes / 1024 / 1024, 1),
                  maxSize: f.number(limits.maxBytes / 1024 / 1024, 0),
                })
              : t("intro")}
          </p>
        </div>
        {status.kind !== "loading" && status.kind !== "signin" && (
          <>
            <input
              ref={input}
              id={`${id}-files`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              // Opened by the button below; hidden from the page and from screen readers.
              hidden
              onChange={(e) => e.target.files && void choose(e.target.files)}
            />
            <Button
              variant="outline"
              disabled={full || busy}
              onClick={() => input.current?.click()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {picks.length > 0 ? t("addMore") : t("add")}
            </Button>
          </>
        )}
      </div>

      {!scenarioId && picks.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>
      )}
      {status.kind === "signin" && <p className="text-sm text-muted-foreground">{t("signin")}</p>}

      {picks.length > 0 && (
        <div
          role="group"
          aria-labelledby={`${id}-review`}
          className="space-y-3 rounded-md border bg-muted/30 p-3"
        >
          <div>
            <p id={`${id}-review`} className="text-sm font-medium">
              {t("reviewTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("reviewHelp", { max: MAX_SIDE })}</p>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {picks.map((pick) => (
              <li
                key={pick.key}
                className={cn(
                  "overflow-hidden rounded-md border bg-card",
                  !pick.selected && "opacity-60",
                )}
              >
                <label className="block cursor-pointer">
                  {pick.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img src={pick.preview} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                      <ImageOff className="size-5" aria-hidden />
                      {t("noPreview")}
                    </span>
                  )}
                  <span className="flex items-start gap-2 p-2 text-xs">
                    <Checkbox
                      checked={pick.selected}
                      disabled={pick.tooLarge || busy}
                      aria-label={t("select", { name: pick.name })}
                      onCheckedChange={(checked) =>
                        setPicks((current) =>
                          current.map((p) =>
                            p.key === pick.key ? { ...p, selected: checked === true } : p,
                          ),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{pick.name}</span>
                      <span className="block text-muted-foreground">
                        {pick.tooLarge
                          ? t("tooLargeFile")
                          : pick.reduced
                            ? t("reduced", {
                                from: size(pick.originalBytes),
                                to: size(pick.blob.size),
                              })
                            : size(pick.blob.size)}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            {t("summary", {
              count: selected.length,
              size: size(selected.reduce((sum, p) => sum + p.blob.size, 0)),
            })}{" "}
            <span className="text-muted-foreground">
              {t("room", {
                count: Math.max(0, limits.maxCount - usage.count),
                size: size(Math.max(0, limits.maxBytes - usage.bytes)),
              })}
            </span>
          </p>
          {!fits && <p className="text-sm text-destructive">{t("overLimit")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || selected.length === 0 || !fits} onClick={() => void upload()}>
              {status.kind === "uploading" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {t("upload", { count: selected.length })}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={cancel}>
              <X />
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only images */}
              <img
                src={photo.url}
                alt={t("alt", { n: i + 1 })}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-8 opacity-90"
                aria-label={t("delete", { n: i + 1 })}
                onClick={() => void remove(photo)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p
        aria-live="polite"
        className={
          status.kind === "message" && status.error
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {status.kind === "preparing" ? (
          t("preparing", { done: status.done + 1, total: status.total })
        ) : status.kind === "uploading" ? (
          t("uploading", { done: status.done + 1, total: status.total })
        ) : status.kind === "signinToUpload" ? (
          <>
            {t("signinToUpload")}{" "}
            <Link href={signInToSaveHref(locale)} className="font-medium text-primary underline">
              {t("signinLink")} →
            </Link>
          </>
        ) : status.kind === "message" ? (
          status.text
        ) : (
          ""
        )}
      </p>
    </section>
  );
}
