/** Longest side of a photo after it is prepared in the browser, as stored on the server. */
export const MAX_SIDE = 1600;

/** Largest file the server accepts before processing; the stored image is much smaller. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** A photo picked by the user, prepared for upload. */
export interface PreparedPhoto {
  name: string;
  originalBytes: number;
  /** What would be uploaded: the reduced image, or the original file. */
  blob: Blob;
  /** Reduced in size or dimensions. */
  reduced: boolean;
  /** Read by the browser (a preview can be shown); the server still checks every file. */
  readable: boolean;
  /** Even the prepared file is over the server's limit: it cannot be sent. */
  tooLarge: boolean;
}

/**
 * Prepares a photo before uploading: at most 1600 px on its longest side, as WebP, so that more
 * photos fit in the 5 MB per scenario. The original is kept when it is already smaller, and
 * when the browser cannot read it (the server then decides).
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const base = { name: file.name, originalBytes: file.size };
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
    const reduced = !!blob && blob.size < file.size;
    const sent = reduced ? blob : file;
    return { ...base, blob: sent, reduced, readable: true, tooLarge: sent.size > MAX_UPLOAD_BYTES };
  } catch {
    return {
      ...base,
      blob: file,
      reduced: false,
      readable: false,
      tooLarge: file.size > MAX_UPLOAD_BYTES,
    };
  }
}

/** Whether a selection fits in what is left of the scenario's photo limits. */
export function fitsLimits(
  selected: { bytes: number }[],
  usage: { count: number; bytes: number },
  limits: { maxCount: number; maxBytes: number },
): boolean {
  const bytes = selected.reduce((sum, p) => sum + p.bytes, 0);
  return usage.count + selected.length <= limits.maxCount && usage.bytes + bytes <= limits.maxBytes;
}
