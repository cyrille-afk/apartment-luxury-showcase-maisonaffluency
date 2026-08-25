/**
 * Filename-to-caption sanitizer.
 *
 * Converts a raw file URL/path into a human-readable caption, stripping all
 * photographer/device/timestamp/extension noise. Returns null when nothing
 * meaningful remains.
 *
 * Designed to handle real-world uploads from phones, screenshots, cameras,
 * storage buckets, and CDN pipelines.
 */

/** Image/video extensions that can appear at the end of a filename. */
const MEDIA_EXTENSIONS = [
  "avif", "bmp", "gif", "heic", "jpeg", "jpg", "mov", "mp4", "m4v", "png",
  "raw", "tiff", "webp", "webm",
];

const EXTENSION_RE = new RegExp(
  `\\.(?:${MEDIA_EXTENSIONS.join("|")})$`,
  "i"
);

/** Noise tokens that should never appear in a generated caption. */
const NOISE_WORDS = [
  // Screenshots / captures
  "screen shot", "screenshot", "screen capture", "screencapture", "screencap",
  "screen cap", "capture", "snip", "snipping",
  // Camera / phone roll
  "camera", "cam", "iphone", "samsung", "pixel", "gopro", "sony", "canon",
  "nikon", "fuji", "fujifilm", "leica", "olympus", "panasonic",
  // Generic filenames
  "img", "image", "dsc", "dscf", "photo", "photos", "picture", "pictures",
  "pic", "pxl", "whatsapp", "telegram", "signal", "wechat", "untitled",
  "download", "file", "asset", "copy", "final", "finalfinal", "v1", "v2", "v3",
  // Prepositions used in timestamps
  "at",
];

const NOISE_WORD_RE = new RegExp(
  `\\b(?:${NOISE_WORDS.map((w) => w.replace(/\s/g, "\\s")).join("|")})\\b`,
  "gi"
);

/** Standalone AM/PM indicators (only strip when isolated, not acronyms). */
const AM_PM_RE = /\b(am|pm)\b/gi;

/**
 * Date/time patterns that should be removed entirely. These overlap with the
 * noise-word list, but aggressive regex matching is required for compound
 * timestamps like "2026 08 25 at 12.25.36 PM".
 */
const DATE_TIME_PATTERNS: RegExp[] = [
  // 2026-08-25, 2026 08 25, 2026_08_25, 2026/08/25
  /\d{4}[\s\-_/]\d{2}[\s\-_/]\d{2}/gi,
  // 25-08-2026, 25 08 2026, 25/08/2026
  /\d{2}[\s\-_/]\d{2}[\s\-_/]\d{4}/gi,
  // 2026-08-25 at 12.25.36 PM, 2026 08 25 at 12.25.36 PM
  /\d{4}[\s\-_/]\d{2}[\s\-_/]\d{2}[\s\-_]*\bat\b[\s\-_]*\d{1,2}[\s\-_:.]?\d{2}([\s\-_:.]?\d{2})?[\s\-_]*(am|pm)?\b/gi,
  // 25-08-2026 at 12.25.36 PM
  /\d{2}[\s\-_/]\d{2}[\s\-_/]\d{4}[\s\-_]*\bat\b[\s\-_]*\d{1,2}[\s\-_:.]?\d{2}([\s\-_:.]?\d{2})?[\s\-_]*(am|pm)?\b/gi,
  // 12.25.36 PM, 12:25:36 PM, 12.25 PM, 12:25 PM
  /\b\d{1,2}[\s\-_:.]\d{2}([\s\-_:.]\d{2})?[\s\-_]*(am|pm)\b/gi,
  // 12.25.36 (no AM/PM)
  /\b\d{1,2}[\s\-_:.]\d{2}[\s\-_:.]\d{2}\b/gi,
  // Aug 25 2026, August 25 2026, 25 Aug 2026, 25th August 2026
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-_]\d{1,2}(?:st|nd|rd|th)?[\s\-_]\d{4}\b/gi,
  /\b\d{1,2}(?:st|nd|rd|th)?[\s\-_](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-_]\d{4}\b/gi,
  // ISO-ish timestamps: 20260825T122536
  /\b\d{4}\d{2}\d{2}[t\s]\d{2}\d{2}\d{2}\b/gi,
];

/** Supabase storage object names include a leading timestamped prefix. */
const SUPABASE_PREFIX_RE = /^\d{10,}-[a-z0-9]+\./i;

/** UUID-like / hex-hash slugs that should not become captions. */
const HASH_UUID_RE = /\b[0-9a-f]{8}(?:[\s\-_]?[0-9a-f]{4}){3}[\s\-_]?[0-9a-f]{12}\b|\b[0-9a-f]{16,}\b/gi;

/** Strip trailing counters: "Chair_01", "Chair_1", "Chair-2". */
const TRAILING_COUNTER_RE = /[\s\-_]\d+$/;

/** Normalize whitespace and punctuation around a word. */
function collapseWhitespace(str: string): string {
  return str
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a filename from a URL, then sanitize it into a caption.
 * Returns null if the result is empty, too short, or purely numeric/noise.
 */
export function sanitizeFilenameCaption(url: string): string | null {
  try {
    const rawPathname = new URL(url).pathname;
    // Decode percent-encoded spaces and special chars (e.g. %20 -> space).
    const pathname = decodeURIComponent(rawPathname);
    let filename = pathname.split("/").pop() || "";

    // Strip Supabase storage timestamp prefix.
    filename = filename.replace(SUPABASE_PREFIX_RE, "");

    // Strip file extension.
    filename = filename.replace(EXTENSION_RE, "");

    // Normalize separators: underscores, dots used as separators become spaces.
    // Preserve dots that are part of timestamps until date-time removal below.
    filename = filename.replace(/[_-]+/g, " ");

    // Strip UUID / hex hash chunks.
    filename = filename.replace(HASH_UUID_RE, " ");

    // Strip date/time compounds (must run before noise-word stripping).
    for (const re of DATE_TIME_PATTERNS) {
      filename = filename.replace(re, " ");
    }

    // Strip isolated noise words.
    filename = filename.replace(NOISE_WORD_RE, " ");

    // Strip isolated AM/PM.
    filename = filename.replace(AM_PM_RE, " ");

    // Remove standalone numeric tokens (camera counters, counters in the middle).
    filename = filename.replace(/\b\d+\b/g, " ");

    // Strip trailing counters.
    filename = filename.replace(TRAILING_COUNTER_RE, "");

    // Clean up separators.
    filename = collapseWhitespace(filename);

    // Final guardrails.
    if (!filename || filename.length < 3) return null;
    if (/^\d+$/.test(filename)) return null;
    if (/^(mp4|mov|webm|m4v|jpeg|jpg|png|webp|avif|gif|heic|tiff|raw)$/i.test(filename)) return null;

    // Title-case the remaining words.
    return filename
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return null;
  }
}

/**
 * Convenience: returns the sanitized filename from a URL, or null if it
 * matches the same noise patterns. Use this as the fallback caption for
 * editorial media.
 */
export function captionFromUrl(url: string): string | null {
  return sanitizeFilenameCaption(url);
}
