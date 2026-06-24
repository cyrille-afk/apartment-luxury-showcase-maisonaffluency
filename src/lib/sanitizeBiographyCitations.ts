/**
 * Media-safe biography sanitizer.
 *
 * Removes citation noise from biography source text while preserving standalone
 * media embeds (YouTube / Vimeo / Cloudinary) that the editorial renderer
 * turns into inline video/image blocks.
 *
 * Rules:
 *   1. `[label](https://…)` markdown links → `label` (we never write media as
 *      markdown links; they always live on their own line).
 *   2. `[Source: …]` / `[Sources: …]` citation brackets → removed entirely
 *      (with the preceding space, if any).
 *   3. Bare URL lines whose host is NOT a known media host → removed.
 *   4. Standalone media URL lines (optionally followed by ` | caption | align`)
 *      are preserved verbatim.
 *
 * Mirrors the Postgres function `public.sanitize_biography_citations`.
 * Keep both in sync if you change the rules.
 */

const MEDIA_HOST_RE =
  /(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|res\.cloudinary\.com)$/i;

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(https?:\/\/[^)]+\)/g;
const SOURCE_BRACKET_RE = /\s*\[Sources?:[^\]]*\]/gi;
const BARE_URL_LINE_RE = /^[ \t]*(https?:\/\/[^\s|]+)(\s*\|[^\n]*)?[ \t]*$/;

const isMediaUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;
    return MEDIA_HOST_RE.test(host);
  } catch {
    return false;
  }
};

export function sanitizeBiographyCitations(input: string | null | undefined): string {
  if (!input) return "";

  // 1. Strip markdown links → keep the visible label only.
  let out = input.replace(MARKDOWN_LINK_RE, "$1");

  // 2. Strip `[Source: …]` / `[Sources: …]` citation brackets entirely.
  out = out.replace(SOURCE_BRACKET_RE, "");


  // 2. Walk line-by-line; drop bare non-media URL lines, keep media lines.
  out = out
    .split("\n")
    .filter((line) => {
      const m = line.match(BARE_URL_LINE_RE);
      if (!m) return true;
      return isMediaUrl(m[1]);
    })
    .join("\n");

  // 3. Collapse 3+ blank lines down to 2.
  out = out.replace(/\n{3,}/g, "\n\n");

  return out;
}
