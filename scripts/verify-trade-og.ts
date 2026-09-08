/**
 * Verifies that the clean /trade-program URL serves Trade Program OG tags
 * to real social crawlers — not the homepage fallback.
 *
 * Run: bun scripts/verify-trade-og.ts
 * If every agent reports OK, it is safe to set CLEAN_URL_OG_VERIFIED = true
 * in src/lib/tradeShareUrl.ts.
 */

const URL_UNDER_TEST = "https://www.maisonaffluency.com/trade-program";
const EXPECTED_IMAGE = "trade-program-hero-authentic-v3.jpg";
const EXPECTED_TITLE_FRAGMENT = "Trade Program";

const AGENTS = [
  "WhatsApp/2.23.20.0 A",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "LinkedInBot/1.0",
];

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  return html.match(re)?.[1] ?? null;
}

let allOk = true;

for (const ua of AGENTS) {
  const res = await fetch(URL_UNDER_TEST, { headers: { "user-agent": ua } });
  const html = await res.text();
  const title = meta(html, "og:title");
  const image = meta(html, "og:image");
  const ok =
    !!title &&
    title.includes(EXPECTED_TITLE_FRAGMENT) &&
    !!image &&
    image.includes(EXPECTED_IMAGE);
  allOk &&= ok;
  console.log(`${ok ? "OK  " : "FAIL"} ${ua}`);
  console.log(`      og:title = ${title}`);
  console.log(`      og:image = ${image}`);
}

console.log(
  allOk
    ? "\nClean URL is safe to share. Set CLEAN_URL_OG_VERIFIED = true."
    : "\nClean URL still falls back. Keep CLEAN_URL_OG_VERIFIED = false.",
);

if (!allOk) process.exit(1);
