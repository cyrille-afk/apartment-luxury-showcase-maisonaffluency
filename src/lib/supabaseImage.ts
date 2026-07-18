/**
 * Rewrite a Supabase Storage public object URL to go through the
 * `/render/image/public/` transformation endpoint so we can serve a
 * right-sized, re-encoded WebP/AVIF (Supabase negotiates via Accept)
 * instead of the raw original.
 *
 * Safe no-op for any URL that isn't a Supabase public object.
 */
export function supabaseImageTransform(
  src: string | null | undefined,
  opts: { width: number; quality?: number; resize?: "cover" | "contain" } = {
    width: 600,
  }
): string | undefined {
  if (!src) return undefined;
  if (!src.includes("/storage/v1/object/public/")) return src;
  const { width, quality = 65, resize = "cover" } = opts;
  const rendered = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}width=${width}&quality=${quality}&resize=${resize}`;
}

/**
 * Build a `srcSet` string for responsive `<img>` rendering off a
 * Supabase Storage URL.
 */
export function supabaseImageSrcSet(
  src: string | null | undefined,
  widths: number[] = [300, 600, 900],
  quality = 65
): string | undefined {
  if (!src || !src.includes("/storage/v1/object/public/")) return undefined;
  return widths
    .map((w) => `${supabaseImageTransform(src, { width: w, quality })} ${w}w`)
    .join(", ");
}
