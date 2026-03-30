/**
 * Inject Cloudinary auto-format/quality transforms into image URLs.
 *
 * - For native Cloudinary upload URLs, inserts `w_1280,q_auto,f_auto` after `/upload/`
 *   (skips if transforms already present).
 * - For external URLs, proxies through Cloudinary fetch with the same transforms.
 * - Video URLs, data URIs, and local paths are returned unchanged.
 */

const CLOUD_NAME = "dif1oamtj";
const DEFAULT_TRANSFORMS = "w_1280,q_auto,f_auto";

const UPLOAD_RE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)/;
const HAS_TRANSFORMS_RE = /^(w_|q_|f_|c_|h_|e_|ar_|g_|dpr_)/;

export function optimizeImageUrl(
  url: string,
  transforms = DEFAULT_TRANSFORMS
): string {
  if (!url) return url;

  // Skip non-http, data URIs, local paths, videos
  if (!/^https?:\/\//i.test(url)) return url;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return url;
  if (/\/video\/upload/i.test(url)) return url;
  if (/youtube|youtu\.be|vimeo/i.test(url)) return url;

  // Native Cloudinary upload URL
  const match = url.match(UPLOAD_RE);
  if (match) {
    const [, prefix, rest] = match;
    // Check if transforms already present (first path segment before version)
    const firstSegment = rest.split("/")[0];
    if (HAS_TRANSFORMS_RE.test(firstSegment)) {
      // Already has transforms — skip
      return url;
    }
    return `${prefix}${transforms}/${rest}`;
  }

  // External image URL → proxy via Cloudinary fetch
  if (/\.(jpe?g|png|webp|avif|gif|bmp|tiff?)(\?|$)/i.test(url)) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transforms}/${url}`;
  }

  return url;
}
