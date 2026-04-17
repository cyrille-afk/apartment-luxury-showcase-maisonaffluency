/**
 * WhatsApp share utility with deep-link support and mobile compatibility.
 *
 * Uses static bridge HTML files with pre-baked OG tags for reliable
 * social previews on WhatsApp, iMessage, Slack, etc.
 */

const SITE_URL = "https://www.maisonaffluency.com";
const OG_SHARE_VERSION = "20260327i";

type ShareSection = "designer" | "collectible" | "atelier";

/** Slugify a name for URL paths — matches the Gallery.tsx slugify */
export const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâäáã]/g, 'a')
    .replace(/[ùûüú]/g, 'u')
    .replace(/[ôöóõ]/g, 'o')
    .replace(/[îïí]/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/ř/g, 'r')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Build a share URL using Maison Affluency domain only (never backend URLs).
 */
export const buildOgUrl = (path: string) => buildSiteShareUrl(path);

const appendOgVersion = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", OG_SHARE_VERSION);
    parsed.searchParams.set("t", Date.now().toString());
    return parsed.toString();
  } catch {
    return url;
  }
};

export const withOgCacheBust = (url: string) => appendOgVersion(url);

const DESIGNER_OG_BRIDGE_OVERRIDES: Record<string, string> = {
  "as-atelier": "/designers/as-atelier-og-v2.html",
  "achille-salvagni-atelier": "/designers/as-atelier-og-v2.html",
};

/**
 * Build a static bridge file URL for a designer profile.
 * All designers now default to -og-v2.html to bust WhatsApp's stale cache.
 */
export const buildDesignerOgUrl = (name: string) =>
  withOgCacheBust(
    `${SITE_URL}${
      DESIGNER_OG_BRIDGE_OVERRIDES[slugify(name)] ??
      `/designers/${slugify(name)}-og-v2.html`
    }`
  );

/**
 * Build a static bridge file URL for an atelier/brand.
 * All ateliers now default to -og-v2.html to bust WhatsApp's stale cache.
 */
const ATELIER_OG_BRIDGE_OVERRIDES: Record<string, string> = {
  "ecart-paris": "/ateliers/ecart-paris-og-v3.html",
};

export const buildAtelierOgUrl = (name: string) => {
  const slug = slugify(name);
  const overridePath = ATELIER_OG_BRIDGE_OVERRIDES[slug];
  return withOgCacheBust(`${SITE_URL}${overridePath ?? `/ateliers/${slug}-og-v2.html`}`);
};

/**
 * Build an OG bridge URL for a parent brand card (shows the brand + its designers).
 * Falls back to the standard atelier OG bridge if no parent-specific bridge exists.
 */
const PARENT_BRAND_OG_OVERRIDES: Record<string, string> = {
  "ecart-paris": "/ateliers/ecart-paris-designers-og-v2.html",
};

export const buildParentBrandOgUrl = (name: string) => {
  const slug = slugify(name);
  const overridePath = PARENT_BRAND_OG_OVERRIDES[slug];
  if (overridePath) return withOgCacheBust(`${SITE_URL}${overridePath}`);
  return buildAtelierOgUrl(name);
};

/**
 * Piece-specific OG bridge overrides for collectible items.
 * Key format: "designer-slug/piece-slug"
 */
const PIECE_OG_BRIDGE_OVERRIDES: Record<string, string> = {
  "christopher-boots/prometheus-iii-astraea": "/collectibles/christopher-boots-prometheus-iii-astraea-og.html",
  "man-of-parts/frenchmen-street-armchair": "/collectibles/man-of-parts-frenchmen-street-armchair-og.html",
};

/**
 * Build a piece-specific OG bridge URL for a curator pick.
 * Falls back to the designer OG bridge if no piece-specific bridge exists.
 */
export const buildPieceOgUrl = (designerName: string, pieceTitle: string) => {
  const key = `${slugify(designerName)}/${slugify(pieceTitle)}`;
  const override = PIECE_OG_BRIDGE_OVERRIDES[key];
  if (override) return withOgCacheBust(`${SITE_URL}${override}`);
  return buildDesignerOgUrl(designerName);
};

/**
 * Build a deep-link URL for a specific designer/brand profile.
 * @deprecated Use buildDesignerOgUrl or buildAtelierOgUrl for social sharing
 */
export const buildProfileUrl = (section: ShareSection, id: string) =>
  `${SITE_URL}/#${section}/${id}`;

/**
 * Open WhatsApp with a pre-filled message.
 * Uses location.href on mobile for reliability (window.open is blocked on many mobile browsers).
 */
export const shareOnWhatsApp = (message: string) => {
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = waUrl;
  } else {
    window.open(waUrl, "_blank");
  }
};

/**
 * Share a specific SPA page on WhatsApp with proper OG preview support.
 */
type SharePageOptions = {
  directUrlPath?: string;
};

const buildSiteShareUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${SITE_URL}${normalizedPath}`;
  return /\.html(?:$|\?)/i.test(normalizedPath)
    ? withOgCacheBust(url)
    : url;
};

export const sharePageOnWhatsApp = (
  path: string,
  title: string,
  subtitle?: string,
  options?: SharePageOptions
) => {
  const url = options?.directUrlPath
    ? buildSiteShareUrl(options.directUrlPath)
    : buildOgUrl(path);
  const message = subtitle
    ? `${title} – ${subtitle}: ${url}`
    : `${title}: ${url}`;
  shareOnWhatsApp(message);
};

/**
 * Share a designer or atelier profile on WhatsApp using static OG bridge files.
 */
export const shareProfileOnWhatsApp = (
  section: ShareSection,
  _id: string,
  name: string,
  subtitle?: string
) => {
  const url = section === "atelier"
    ? buildAtelierOgUrl(name)
    : buildDesignerOgUrl(name);
  const message = subtitle
    ? `Check out ${name} – ${subtitle} at Maison Affluency: ${url}`
    : `Check out ${name} at Maison Affluency: ${url}`;
  shareOnWhatsApp(message);
};
