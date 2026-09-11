import type { ImgHTMLAttributes } from "react";
import { toResponsiveCloudinary, toCloudinaryFetch } from "@/lib/cloudinary";

const CLD_RE = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/(?:upload|fetch)\//i;

export interface CldPictureProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "loading"> {
  src: string | undefined | null;
  alt: string;
  /** Above-the-fold image: eager + high fetch priority. Everything else lazy-loads. */
  priority?: boolean;
  /** Desktop candidate widths. */
  widths?: number[];
  /** Desktop `sizes` hint. */
  sizes?: string;
  /** Mobile (<=640px) candidate widths. Capped at 640 by design. */
  mobileWidths?: number[];
  /** Class applied to the <img>. */
  className?: string;
  /** Optional wrapper class on the <picture> element. */
  pictureClassName?: string;
}

const isCloudinary = (url: string) => CLD_RE.test(url);

/**
 * Responsive Cloudinary <picture>.
 *
 * Phones (<=640px) get their own <source> with `f_auto,q_auto:eco` and a hard
 * width ceiling of 640px — chosen by the browser from CSS media queries, not
 * from JS viewport sniffing, so it is correct on first paint and after resize.
 * Non-Cloudinary URLs fall through to a plain <img> with the same loading rules.
 */
export function CldPicture({
  src,
  alt,
  priority = false,
  widths = [640, 960, 1280, 1600],
  mobileWidths = [480, 640],
  sizes = "100vw",
  className,
  pictureClassName = "contents",
  decoding,
  ...imgProps
}: CldPictureProps) {
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";
  const resolvedDecoding = decoding ?? (priority ? "sync" : "async");

  if (!src) return null;

  const target = isCloudinary(src) ? src : toCloudinaryFetch(src);

  if (!isCloudinary(target)) {
    return (
      <img
        {...imgProps}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={resolvedDecoding}
      />
    );
  }

  const mobileSrcSet = mobileWidths
    .map((w) => `${toResponsiveCloudinary(target, { width: Math.min(w, 640), quality: "auto:eco", crop: "scale" })} ${w}w`)
    .join(", ");

  const desktopSrcSet = widths
    .map((w) => `${toResponsiveCloudinary(target, { width: w, quality: "auto:good" })} ${w}w`)
    .join(", ");

  const fallbackSrc = toResponsiveCloudinary(target, {
    width: widths[Math.min(1, widths.length - 1)],
    quality: "auto:good",
  });

  return (
    <picture className={pictureClassName}>
      <source media="(max-width: 640px)" srcSet={mobileSrcSet} sizes="100vw" />
      <source media="(min-width: 641px)" srcSet={desktopSrcSet} sizes={sizes} />
      <img
        {...imgProps}
        src={fallbackSrc}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={resolvedDecoding}
      />
    </picture>
  );
}

export default CldPicture;
