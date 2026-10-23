export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Detect type from file signature (magic bytes). Never trust the client-declared type. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  return null;
}

/** PDFs with active content are rejected. */
export function pdfHasActiveContent(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  return /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/.test(text);
}

const EXT: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function safeFileName(original: string, mime: AllowedMime): string {
  const base = original
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "document"}.${EXT[mime]}`;
}

export type UploadCheck =
  | { ok: true; mime: AllowedMime }
  | { ok: false; error: "too_large" | "empty" | "invalid_type" | "active_content" };

export function checkUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "invalid_type" };
  if (mime === "application/pdf" && pdfHasActiveContent(bytes))
    return { ok: false, error: "active_content" };
  return { ok: true, mime };
}
