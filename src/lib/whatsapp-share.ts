/**
 * WhatsApp share utility with deep-link support and mobile compatibility.
 *
 * For pages that need rich OG previews (trade/program, journal, etc.) we route
 * through the `og-image` edge function which serves static HTML with the correct
 * OG tags and then redirects the browser to the real SPA page.
 */

const SITE_URL = "https://maisonaffluency.com";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "dcrauiygaezoduwdjmsm";
const OG_FUNCTION_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-image`;
const OG_SHARE_VERSION = "20260320c";

type ShareSection = "designer" | "collectible" | "atelier";

/**
 * Build an OG-friendly URL for a specific SPA route.
 * Crawlers see proper OG tags; real browsers are redirected to the SPA.
 */
export const buildOgUrl = (path: string) =>
  `${OG_FUNCTION_BASE}?path=${encodeURIComponent(path)}&v=${OG_SHARE_VERSION}`;

/**
 * Build a deep-link URL for a specific designer/brand profile.
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
 * The shared URL goes through the og-image edge function so crawlers
 * see the correct title, description, and image.
 */
export const sharePageOnWhatsApp = (
  path: string,
  title: string,
  subtitle?: string
) => {
  const url = buildOgUrl(path);
  const message = subtitle
    ? `${title} – ${subtitle}: ${url}`
    : `${title}: ${url}`;
  shareOnWhatsApp(message);
};

/**
 * Convenience: share a designer/brand profile on WhatsApp with a deep link.
 */
export const shareProfileOnWhatsApp = (
  section: ShareSection,
  id: string,
  name: string,
  subtitle?: string
) => {
  const url = buildProfileUrl(section, id);
  const message = subtitle
    ? `Check out ${name} – ${subtitle} at Maison Affluency: ${url}`
    : `Check out ${name} at Maison Affluency: ${url}`;
  shareOnWhatsApp(message);
};
