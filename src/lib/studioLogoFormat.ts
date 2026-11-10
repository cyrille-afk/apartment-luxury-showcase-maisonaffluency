/**
 * Studio logos are typed in as arbitrary URLs, so the branding panel needs one
 * rule for what counts as a renderable logo link. Recognised raster and vector
 * extensions are accepted; extension-less CDN links (Cloudinary `f_auto`
 * delivery URLs, for example) stay renderable because the browser can still
 * load them — only a link whose extension is known but unsupported is refused.
 */
export const SUPPORTED_LOGO_EXTENSIONS = ["png", "svg", "jpg", "jpeg", "webp"] as const;

export type SupportedLogoExtension = (typeof SUPPORTED_LOGO_EXTENSIONS)[number];

/** Lowercase extension of the file part of a URL, or null when it has none. */
export function logoFileExtension(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;

  let path = trimmed;
  try {
    path = new URL(trimmed).pathname;
  } catch {
    // Relative or malformed value: strip query/hash and read the raw string.
    path = trimmed.split(/[?#]/)[0] ?? trimmed;
  }

  const file = path.split("/").pop() ?? "";
  const dot = file.lastIndexOf(".");
  if (dot <= 0 || dot === file.length - 1) return null;
  return file.slice(dot + 1).toLowerCase();
}

/** True when the link can be rendered as a logo preview. */
export function isSupportedLogoUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;
  const extension = logoFileExtension(trimmed);
  if (extension === null) return true;
  return (SUPPORTED_LOGO_EXTENSIONS as readonly string[]).includes(extension);
}

/** Human-readable format name for the preview caption, or null when unknown. */
export function logoFormatLabel(url: string | null | undefined): string | null {
  const extension = logoFileExtension(url ?? "");
  if (!extension) return null;
  switch (extension) {
    case "svg":
      return "SVG vector";
    case "png":
      return "PNG image";
    case "jpg":
    case "jpeg":
      return "JPG image";
    case "webp":
      return "WEBP image";
    default:
      return null;
  }
}

/** Plain-language list of accepted formats, used in helper copy. */
export const SUPPORTED_LOGO_FORMAT_COPY = "PNG, SVG, JPG, JPEG or WEBP";
