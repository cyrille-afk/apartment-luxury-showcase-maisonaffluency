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
