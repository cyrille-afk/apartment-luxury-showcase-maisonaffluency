/**
 * WhatsApp share utility with deep-link support and mobile compatibility.
 *
 * Uses static bridge HTML files with pre-baked OG tags for reliable
 * social previews on WhatsApp, iMessage, Slack, etc.
 */

const SITE_URL = "https://www.maisonaffluency.com";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "dcrauiygaezoduwdjmsm";
const OG_FUNCTION_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-image`;
const OG_SHARE_VERSION = "20260322a";

type ShareSection = "designer" | "collectible" | "atelier";

/** Slugify a name for URL paths — matches the Gallery.tsx slugify */
export const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ôö]/g, 'o')
    .replace(/[îï]/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/ř/g, 'r')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Build an OG-friendly URL for a specific SPA route.
 * Prefer static bridge files on the main domain for reliable OG previews.
 * Falls back to the edge function for dynamic routes (products, journal, etc.).
 */
export const buildOgUrl = (path: string) =>
  `${OG_FUNCTION_BASE}?path=${encodeURIComponent(path)}&v=${OG_SHARE_VERSION}&t=${Date.now()}`;

/**
 * Build a static bridge file URL for a designer profile.
 */
export const buildDesignerOgUrl = (name: string) =>
  `${SITE_URL}/designers/${slugify(name)}-og.html`;

/**
 * Build a static bridge file URL for an atelier/brand.
 */
export const buildAtelierOgUrl = (name: string) =>
  `${SITE_URL}/ateliers/${slugify(name)}-og.html`;

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

const buildSiteShareUrl = (path: string) => `${SITE_URL}${path}`;

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
