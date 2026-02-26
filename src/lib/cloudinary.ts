/**
 * Cloudinary image URL builder
 * Cloud name: dif1oamtj
 */

const CLOUD_NAME = "dif1oamtj";
const BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

export interface CloudinaryTransform {
  width?: number;
  height?: number;
  quality?: "auto" | "auto:low" | "auto:eco" | "auto:good" | "auto:best" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  crop?: "fill" | "fit" | "scale" | "thumb" | "limit" | "pad";
  gravity?: "auto" | "face" | "center" | "north" | "south";
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
  return `${BASE_URL}/${transformStr}/${publicId}`;
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
    src: cloudinaryUrl(publicId, { width: 1600, quality: "auto:good" }),
    srcSet: cloudinarySrcSet(publicId, [800, 1200, 1600, 2400]),
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Designer/atelier cards — medium */
  card: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 800, quality: "auto" }),
    srcSet: cloudinarySrcSet(publicId, [400, 600, 800, 1200]),
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Thumbnails — small */
  thumb: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 400, quality: "auto" }),
    srcSet: cloudinarySrcSet(publicId, [200, 400, 600]),
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),

  /** Lightbox / full-screen — max quality */
  lightbox: (publicId: string) => ({
    src: cloudinaryUrl(publicId, { width: 2400, quality: "auto:best" }),
    srcSet: cloudinarySrcSet(publicId, [800, 1200, 1600, 2400, 3200]),
    placeholder: cloudinaryBlurPlaceholder(publicId),
  }),
} as const;
