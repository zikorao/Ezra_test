export const ARTIFACTS_BUCKET = "artifacts";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function mimeLabel(mime: string): string {
  if (mime === "text/html") return "HTML";
  if (mime.startsWith("image/")) return "Image";
  if (mime === "application/pdf") return "PDF";
  return mime;
}
