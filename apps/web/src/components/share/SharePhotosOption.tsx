"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getSharing, setSharePhotos } from "./actions";

/**
 * Whether the read-only link and its PDF show the property's photos. Off by default: photos
 * are private until the owner ticks this. Render it with the link's token as `key`, so a new
 * link (which starts without photos) reloads the setting.
 */
export function SharePhotosOption({ scenarioId }: { scenarioId: number }) {
  const t = useTranslations("share");
  const id = useId();
  const [photos, setPhotos] = useState<boolean | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let current = true;
    getSharing(scenarioId)
      .then((sharing) => current && setPhotos(sharing?.photos ?? false))
      .catch(() => current && setPhotos(false));
    return () => {
      current = false;
    };
  }, [scenarioId]);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          className="mt-0.5"
          checked={photos ?? false}
          disabled={photos === undefined || pending}
          onCheckedChange={(checked) =>
            start(async () => {
              setFailed(false);
              const result = await setSharePhotos(scenarioId, checked === true).catch(
                () => undefined,
              );
              if (result) setPhotos(result.photos);
              else setFailed(true);
            })
          }
        />
        <Label htmlFor={id} className="text-sm leading-snug font-normal">
          {t("sharePhotos")}
        </Label>
      </div>
      {failed && (
        <p className="text-xs text-destructive" role="alert">
          {t("sharePhotosError")}
        </p>
      )}
    </div>
  );
}
