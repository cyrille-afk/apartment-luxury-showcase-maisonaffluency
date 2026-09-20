/**
 * Trade Program share-link guard.
 *
 * The clean URL https://www.maisonaffluency.com/trade-program is a client-rendered
 * SPA route. Social crawlers (WhatsApp, facebookexternalhit, Twitterbot) do not run
 * JavaScript, so they only see the static index.html head — which is the HOMEPAGE
 * title/description/image. Sharing the clean URL therefore silently falls back to the
 * homepage preview.
 *
 * The only way the clean URL can carry Trade Program OG tags is if the Cloudflare
 * crawler Worker (cloudflare-worker/src/worker.js) is deployed in front of the domain
 * and serves the static OG shell for that path.
 *
 * Until that is verified live, every share action must use the bridge file, which
 * always serves the correct tags.
 *
 * Verify with: bun scripts/verify-trade-og.ts
 * Only flip CLEAN_URL_OG_VERIFIED to true after that script reports OK.
 */

/** Set to true ONLY after the crawler Worker is deployed and verified live. */
export const CLEAN_URL_OG_VERIFIED = false;

export const TRADE_PROGRAM_CLEAN_URL =
  "https://www.maisonaffluency.com/trade-program";

/** Static OG bridge — always serves the Trade Program title/description/image. */
export const TRADE_PROGRAM_BRIDGE_URL =
  "https://www.maisonaffluency.com/trade-program-share.html";

export const TRADE_PROGRAM_SHARE_IMAGE =
  "https://www.maisonaffluency.com/trade-program-hero-authentic-v3.jpg";

/**
 * Returns the URL that is safe to hand to a social crawler.
 * Falls back to the OG bridge whenever the clean URL is not verified.
 */
export function getTradeProgramShareUrl(): string {
  return CLEAN_URL_OG_VERIFIED
    ? TRADE_PROGRAM_CLEAN_URL
    : TRADE_PROGRAM_BRIDGE_URL;
}
