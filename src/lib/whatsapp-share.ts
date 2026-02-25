/**
 * WhatsApp share utility with deep-link support and mobile compatibility.
 */

const SITE_URL = "https://maisonaffluency.com";

type ShareSection = "designer" | "collectible" | "atelier";

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
