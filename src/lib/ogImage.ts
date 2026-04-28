/**
 * Open Graph image helpers.
 *
 * - `toOgImage(url)` returns a 1200×630 Cloudinary-optimised version of any
 *   Cloudinary asset. Non-Cloudinary URLs are returned untouched.
 * - `OG_FALLBACK` is the branded Maison Affluency social card used when a
 *   page has no hero / first product image.
 */

export const OG_FALLBACK =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";

const OG_TRANSFORM = "w_1200,h_630,c_fill,q_auto:best,f_jpg";

export function toOgImage(url: string | null | undefined): string {
  if (!url) return OG_FALLBACK;
  if (!url.includes("res.cloudinary.com")) return url;
  // Replace any existing transform segment immediately after /upload/
  if (/\/upload\/[^/]*[wch]_\d+/.test(url)) {
    return url.replace(/\/upload\/[^/]+\//, `/upload/${OG_TRANSFORM}/`);
  }
  return url.replace("/upload/", `/upload/${OG_TRANSFORM}/`);
}
