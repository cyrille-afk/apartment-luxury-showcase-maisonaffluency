/**
 * Dynamic OG meta-tag server for SPA routes.
 *
 * Social-media crawlers (WhatsApp, Facebook, Twitter, LinkedIn, Telegram, etc.)
 * don't execute JavaScript, so they never see react-helmet-async tags.
 * This function serves a tiny HTML page with the correct OG tags for a given
 * route, then redirects real browsers to the SPA via <meta http-equiv="refresh">.
 *
 * Usage:
 *   https://<project>.supabase.co/functions/v1/og-image?path=/trade/program
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL = "https://maisonaffluency.com";
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";
const TRADE_IMAGE =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex";

interface OgData {
  title: string;
  description: string;
  image: string;
  url: string;
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Resolve an image URL to an absolute, 1200×630 OG-ready URL */
function ogImage(url: string): string {
  if (!url) return DEFAULT_IMAGE;
  // Make relative paths absolute
  if (url.startsWith("/")) {
    return `${SITE_URL}${url}`;
  }
  // For Cloudinary URLs, strip existing transforms and apply OG-optimised ones
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    // Remove any existing transformation chain between /upload/ and /v{timestamp}
    const cleaned = url.replace(/\/upload\/[^v][^/]*(?:\/[^v][^/]*)*\//, "/upload/");
    return cleaned.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/");
  }
  return url;
}

/** Route → OG metadata map. Static routes first, then dynamic DB lookups. */
async function getOgData(path: string): Promise<OgData> {
  const clean = path.replace(/\/+$/, "") || "/";

  // ── Static routes ──────────────────────────────────────────────
  switch (clean) {
    case "/trade/program":
      return {
        title: "Trade Program — Maison Affluency",
        description:
          "Exclusive benefits for architects and interior designers — trade pricing, dedicated client advisors, custom requests, material libraries, and consolidated insured shipping.",
        image: TRADE_IMAGE,
        url: `${SITE_URL}/trade/program`,
      };

    case "/trade/register":
      return {
        title: "Apply to Trade Program — Maison Affluency",
        description:
          "Register as a trade professional to access exclusive pricing, curated collections, and dedicated design support from Maison Affluency.",
        image: TRADE_IMAGE,
        url: `${SITE_URL}/trade/register`,
      };

    case "/journal":
      return {
        title: "Journal — Maison Affluency",
        description:
          "Stories, interviews, and insights from the world of collectible design and luxury furniture.",
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}/journal`,
      };
  }

  // ── Dynamic: Journal article /journal/:slug ────────────────────
  const journalMatch = clean.match(/^\/journal\/([^/]+)$/);
  if (journalMatch) {
    const slug = journalMatch[1];
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("journal_articles")
      .select("title, excerpt, cover_image_url")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (data) {
      return {
        title: `${data.title} — Maison Affluency Journal`,
        description: data.excerpt || "Read more on the Maison Affluency Journal.",
        image: ogImage(data.cover_image_url || ""),
        url: `${SITE_URL}/journal/${slug}`,
      };
    }
  }

  // ── Dynamic: Product page /product/:id ─────────────────────────
  const productMatch = clean.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const id = productMatch[1];
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("trade_products")
      .select("product_name, brand_name, description, image_url, category")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (data) {
      const desc =
        data.description ||
        `${data.product_name} by ${data.brand_name} — discover this ${data.category} piece at Maison Affluency.`;
      return {
        title: `${data.product_name} by ${data.brand_name} — Maison Affluency`,
        description: desc.length > 160 ? desc.slice(0, 157) + "…" : desc,
        image: ogImage(data.image_url || ""),
        url: `${SITE_URL}/product/${id}`,
      };
    }
  }

  // ── Fallback: homepage ─────────────────────────────────────────
  return {
    title: "Maison Affluency | Luxury Furniture & Collectible Design",
    description:
      "From Couture Furniture to Collectible Designs Items, Discover Emerging Talents and Design Masters In Our Gallery or Through the Best Ateliers and Designer Works",
    image: DEFAULT_IMAGE,
    url: SITE_URL,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";
  const og = await getOgData(path);

  const redirectUrl = og.url;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(og.title)}</title>
  <meta name="description" content="${escapeHtml(og.description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(og.url)}" />
  <meta property="og:title" content="${escapeHtml(og.title)}" />
  <meta property="og:description" content="${escapeHtml(og.description)}" />
  <meta property="og:image" content="${escapeHtml(og.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Maison Affluency" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(og.title)}" />
  <meta name="twitter:description" content="${escapeHtml(og.description)}" />
  <meta name="twitter:image" content="${escapeHtml(og.image)}" />

  <!-- Redirect real browsers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(redirectUrl)}">${escapeHtml(og.title)}</a>…</p>
</body>
</html>`;

  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");

  return new Response(html, { status: 200, headers });
});
