"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type {
  PhotoInfo,
  PhotosResponse,
  UploadResponse,
} from "@/app/api/scenarios/[id]/photos/route";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/useFormat";

const MAX_SIDE = 1600;

/**
 * Shrinks a photo in the browser before uploading (at most 1600 px, WebP), so that more photos
 * fit in the 5 MB per scenario. The server re-encodes it anyway; on failure the original is sent.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "message"; text: string; error?: boolean };

/** Photos of the property, for a saved scenario: up to 30 photos or 5 MB. */
export function PhotosSection({ scenarioId }: { scenarioId: number | null }) {
  const t = useTranslations("photos");
  const f = useFormat();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [status, setStatus] = useState<Status>({ kind: scenarioId ? "loading" : "idle" });

  useEffect(() => {
    if (!scenarioId) return;
    let current = true;
    fetch(`/api/scenarios/${scenarioId}/photos`)
      .then(async (res) => {
        if (!current) return;
        if (res.status === 401) return setStatus({ kind: "signin" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as PhotosResponse;
        if (!current) return;
        setData(body);
        setStatus({ kind: "idle" });
      })
      .catch(() => current && setStatus({ kind: "message", text: t("loadError"), error: true }));
    return () => {
      current = false;
    };
  }, [scenarioId, t]);

  async function upload(files: FileList) {
    if (!scenarioId || files.length === 0) return;
    const list = [...files];
    let added = 0;
    let stop: string | null = null;
    for (const [i, file] of list.entries()) {
      setStatus({ kind: "uploading", done: i, total: list.length });
      const form = new FormData();
      const blob = await shrink(file);
      form.append("file", blob, file.name);
      const res = await fetch(`/api/scenarios/${scenarioId}/photos`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({ status: "invalid" }))) as UploadResponse;
      if (body.status === "added") {
        added++;
        setData((d) => (d ? { ...d, photos: [...d.photos, body.photo], usage: body.usage } : d));
        continue;
      }
      if (body.status === "invalid") continue; // skip this file, go on with the others
      stop = t(`errors.${body.status}`);
      break;
    }
    if (input.current) input.current.value = "";
    setStatus({
      kind: "message",
      text: stop ?? t("added", { count: added, skipped: list.length - added }),
      error: stop !== null || added < list.length,
    });
  }

  async function remove(photo: PhotoInfo) {
    if (!scenarioId) return;
    const res = await fetch(photo.url, { method: "DELETE" });
    if (!res.ok) return setStatus({ kind: "message", text: t("deleteError"), error: true });
    setData((d) =>
      d
        ? {
            ...d,
            photos: d.photos.filter((p) => p.id !== photo.id),
            usage: { count: d.usage.count - 1, bytes: d.usage.bytes - photo.bytes },
          }
        : d,
    );
  }

  const full =
    !!data &&
    (data.usage.count >= data.limits.maxCount || data.usage.bytes >= data.limits.maxBytes);

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id={`${id}-title`} className="font-semibold">
            {t("title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {data
              ? t("usage", {
                  count: data.usage.count,
                  maxCount: data.limits.maxCount,
                  size: f.number(data.usage.bytes / 1024 / 1024, 1),
                  maxSize: f.number(data.limits.maxBytes / 1024 / 1024, 0),
                })
              : t("intro")}
          </p>
        </div>
        {scenarioId && data && (
          <>
            <input
              ref={input}
              id={`${id}-files`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              // Opened by the button below; hidden from the page and from screen readers.
              hidden
              onChange={(e) => e.target.files && void upload(e.target.files)}
            />
            <Button
              variant="outline"
              disabled={full || status.kind === "uploading"}
              onClick={() => input.current?.click()}
            >
              {status.kind === "uploading" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {t("add")}
            </Button>
          </>
        )}
      </div>

      {!scenarioId && <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>}
      {status.kind === "signin" && <p className="text-sm text-muted-foreground">{t("signin")}</p>}

      {data && data.photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.photos.map((photo, i) => (
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
        {status.kind === "uploading"
          ? t("uploading", { done: status.done + 1, total: status.total })
          : status.kind === "message"
            ? status.text
            : ""}
      </p>
    </section>
  );
}
