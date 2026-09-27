/**
 * Studio logos are often uploaded as screenshots with large empty margins.
 * For Cloudinary-hosted images, inject the `e_trim` transformation so the
 * rendered logo fills its frame instead of shrinking inside the whitespace.
 * Non-Cloudinary URLs are returned unchanged.
 */
export function trimLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  if (url.includes("/image/upload/e_trim")) return url;
  return url.replace("/image/upload/", "/image/upload/e_trim/");
}
