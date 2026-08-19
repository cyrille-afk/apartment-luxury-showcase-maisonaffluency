/**
 * Cloudinary image URL builder
 * Cloud name: dif1oamtj
 */

const CLOUD_NAME = "dif1oamtj";
const BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

/**
 * Cloudinary only returns `Cache-Control: ..., immutable` when the delivery
 * URL carries a version segment (`/v1/...`). Without it the CDN answers with
 * a plain `max-age=2592000`, so browsers revalidate assets on repeat visits.
 * Prefix a synthetic `v1` when the public ID has no version of its own.
 */
const VERSION_RE = /^v\d+\//;
export function withVersion(publicId: string): string {
  if (!publicId) return publicId;
  const clean = publicId.replace(/^\/+/, "");
  return VERSION_RE.test(clean) ? clean : `v1/${clean}`;
}

export interface CloudinaryTransform {
  width?: number;
  height?: number;
  quality?: "auto" | "auto:low" | "auto:eco" | "auto:good" | "auto:best" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  crop?: "fill" | "fit" | "scale" | "thumb" | "limit" | "pad";
  gravity?: "auto" | "face" | "center" | "north" | "south" | "east" | "west";
  dpr?: "auto" | number;
  blur?: number;
}

/**
 * Build a Cloudinary URL with transformations
 */
export function cloudinaryUrl(
  publicId: string,
  transforms: CloudinaryTransform = {}
): string {
  const {
    width,
    height,
    quality = "auto",
    format = "auto",
    crop = "fill",
    gravity,
    dpr,
    blur,
  } = transforms;

  const parts: string[] = [];

  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (crop) parts.push(`c_${crop}`);
  if (gravity) parts.push(`g_${gravity}`);
  if (quality) parts.push(`q_${quality}`);
  if (format) parts.push(`f_${format}`);
  if (dpr) parts.push(`dpr_${dpr}`);
  if (blur) parts.push(`e_blur:${blur}`);

  const transformStr = parts.join(",");
  const encodedTransformStr = transformStr.replace(/,/g, "%2C");
  return `${BASE_URL}/${encodedTransformStr}/${withVersion(publicId)}`;
}

/**
 * Generate a tiny blur placeholder URL (20px wide, heavy blur)
 */
export function cloudinaryBlurPlaceholder(publicId: string): string {
  return cloudinaryUrl(publicId, {
    width: 20,
    quality: "auto:low",
    format: "webp",
    blur: 1000,
    crop: "scale",
  });
}

/**
 * Generate srcSet for responsive images
 */
export function cloudinarySrcSet(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
  transforms: Omit<CloudinaryTransform, "width"> = {}
): string {
  return widths
    .map((w) => `${cloudinaryUrl(publicId, { ...transforms, width: w })} ${w}w`)
    .join(", ");
}

/**
 * Common presets for the project
 */
export const presets = {
  /** Gallery / hero images — large */
  hero: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 1200, quality: "auto:good" }),
    srcSet: cloudinarySrcSet(publicId, [400, 600, 800, 1200, 1600, 2400]),
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw",
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Designer/atelier cards — medium */
  card: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 600, quality: "auto" }),
    srcSet: cloudinarySrcSet(publicId, [300, 400, 600, 800]),
    sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Thumbnails — small */
  thumb: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 300, quality: "auto" }),
    srcSet: cloudinarySrcSet(publicId, [150, 200, 300, 400]),
    sizes: "(max-width: 640px) 33vw, 20vw",
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Lightbox / full-screen — max quality */
  lightbox: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 2400, quality: "auto:best" }),
    srcSet: cloudinarySrcSet(publicId, [600, 800, 1200, 1600, 2400]),
    sizes: "100vw",
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),
} as const;

// ─── Runtime URL rewriter ─────────────────────────────────────────────
// Rewrites ANY Cloudinary delivery URL (whether it already has a
// transform segment or not) to inject width + quality + f_auto so the
// browser never downloads a raw original. Non-Cloudinary URLs pass
// through unchanged.

const CLD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/(?:upload|fetch))\/(.+)$/i;

function isTransformSegment(seg: string): boolean {
  // A transform segment is a comma-separated list of key_value tokens
  // like `w_800,c_fill,q_auto:good,f_auto`. Version segments start
  // with `v<digits>`, and public IDs generally don't contain `_`
  // adjacent to a single-letter prefix followed by `_`.
  if (!seg) return false;
  if (/^v\d+$/.test(seg)) return false;
  // Any comma-separated `x_y` pair is a transform.
  return /(?:^|,)[a-z]{1,3}_[^,/]+/i.test(seg);
}

export interface ResponsiveOptions {
  /** Target rendered width in CSS px (mobile). Default 640. */
  width?: number;
  /** Cloudinary quality. Default "auto:eco". */
  quality?: CloudinaryTransform["quality"];
  /** Crop mode when the source lacks one. Default undefined (no crop). */
  crop?: CloudinaryTransform["crop"];
}

/**
 * Return a Cloudinary URL rewritten with a mobile-friendly width and
 * quality. If the URL already has a transform segment, `w_` and `q_`
 * are replaced; otherwise a fresh transform segment is inserted right
 * after `/upload/` or `/fetch/`.
 */
export function toResponsiveCloudinary(url: string, opts: ResponsiveOptions = {}): string {
  if (!url) return url;
  const m = url.match(CLD_RE);
  if (!m) return url;
  const [, base, rest] = m;
  const width = opts.width ?? 640;
  const quality = opts.quality ?? "auto:eco";
  const parts = rest.split("/");
  const first = parts[0] ?? "";
  if (isTransformSegment(first)) {
    // Replace or add w_ / q_ / f_ inside the existing transform, and
    // drop any hardcoded h_ so overriding the width doesn't distort
    // the aspect ratio when the source pinned both dimensions.
    let tokens = first.split(",").filter(Boolean);
    tokens = tokens.filter((t) => !t.startsWith("h_"));
    const has = (k: string) => tokens.some((t) => t.startsWith(k + "_"));
    const set = (k: string, v: string) => {
      const idx = tokens.findIndex((t) => t.startsWith(k + "_"));
      if (idx >= 0) tokens[idx] = `${k}_${v}`;
      else tokens.push(`${k}_${v}`);
    };
    set("w", String(width));
    set("q", String(quality));
    if (!has("f")) tokens.push("f_auto");
    parts[0] = tokens.join(",");
    const tail = parts.slice(1).join("/");
    return `${base}/${parts[0]}/${withVersion(tail)}`;
  }
  // No transform segment — inject one.
  const injected = [`w_${width}`, `q_${quality}`, `f_auto`];
  if (opts.crop) injected.splice(1, 0, `c_${opts.crop}`);
  return `${base}/${injected.join(",")}/${withVersion(rest)}`;
}

/**
 * Re-host an arbitrary remote image through Cloudinary's fetch delivery so it
 * can carry the same `w_/q_auto/f_auto` transforms as our native uploads.
 * (Same mechanism the `og-rehost` edge function uses server-side.)
 *
 * Returns the URL unchanged when it can't/shouldn't be proxied:
 * already-Cloudinary URLs, non-http sources, data URIs, local paths, videos.
 */
export function toCloudinaryFetch(url: string): string {
  if (!url) return url;
  if (CLD_RE.test(url)) return url;
  if (!/^https:\/\//i.test(url)) return url; // fetch requires a public https origin
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return url;
  if (/youtube|youtu\.be|vimeo/i.test(url)) return url;
  if (/res\.cloudinary\.com/i.test(url)) return url;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${encodeURIComponent(url)}`;
}

/**
 * Build responsive `<img>` props for any image URL, safe for arbitrary
 * DB-stored values. Native Cloudinary URLs are rewritten in place; remote
 * third-party originals are re-hosted through Cloudinary fetch so they also
 * get width-scaled, `q_auto,f_auto` variants plus a srcSet.
 */
export function cldResponsiveImg(
  url: string | undefined | null,
  opts: { widths?: number[]; sizes?: string; quality?: CloudinaryTransform["quality"] } = {}
): { src: string; srcSet?: string; sizes?: string } {
  if (!url) return { src: "" };
  const target = CLD_RE.test(url) ? url : toCloudinaryFetch(url);
  if (!CLD_RE.test(target)) return { src: url };
  const widths = opts.widths ?? [320, 480, 640, 960, 1280];
  const quality = opts.quality ?? "auto:eco";
  const src = toResponsiveCloudinary(target, { width: widths[Math.min(2, widths.length - 1)], quality });
  const srcSet = widths
    .map((w) => `${toResponsiveCloudinary(target, { width: w, quality })} ${w}w`)
    .join(", ");
  return { src, srcSet, sizes: opts.sizes };
}


