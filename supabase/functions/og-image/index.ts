/**
 * Dynamic OG meta-tag server for SPA routes.
 *
 * Social-media crawlers (WhatsApp, Facebook, Twitter, LinkedIn, Telegram, etc.)
 * don't execute JavaScript, so they never see react-helmet-async tags.
 * This function serves a tiny HTML page with the correct OG tags for a given
 * route, then redirects real browsers to the SPA via JavaScript.
 *
 * Usage:
 *   https://<project>.supabase.co/functions/v1/og-image?path=/trade/program
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL = "https://www.maisonaffluency.com";
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

function ensureCloudinaryImageExtension(url: string): string {
  if (
    url.includes("cloudinary.com") &&
    !/\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i.test(url)
  ) {
    return `${url}.jpg`;
  }
  return url;
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
    const transformed = cleaned.replace(
      "/upload/",
      "/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/"
    );
    return ensureCloudinaryImageExtension(transformed);
  }

  return url;
}

/** Route → OG metadata map. Static routes first, then dynamic DB lookups. */
async function getOgData(path: string, reqUrl?: URL): Promise<OgData> {
  const clean = path.replace(/\/+$/, "") || "/";

  // ── Section hash routes (e.g. /#designers, /#collectibles, /#brands) ──
  const sectionHashMatch = clean.match(/^\/?#(designers|collectibles|brands|gallery|overview|contact)$/);
  if (sectionHashMatch) {
    const section = sectionHashMatch[1];
    const sectionMeta: Record<string, { title: string; description: string; image: string }> = {
      designers: {
        title: "Designers & Makers On View — Maison Affluency",
        description: "Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting.",
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg",
      },
      collectibles: {
        title: "Collectible Design On View — Maison Affluency",
        description: "Unique and limited-edition functional art pieces — sculptural furniture, lighting, and ceramics by contemporary collectible designers.",
        image: "https://design-milk.com/images/2024/02/draga-aurel-flare-collection-15.jpg",
      },
      brands: {
        title: "Ateliers & Partners — Maison Affluency",
        description: "We collaborate with the world's most distinguished furniture houses, textile ateliers, and artisan workshops to bring exceptional pieces to discerning collectors.",
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg",
      },
      gallery: {
        title: "Gallery — Maison Affluency",
        description: "Experience our curated gallery of luxury furniture and collectible design.",
        image: DEFAULT_IMAGE,
      },
      overview: {
        title: "Overview — Maison Affluency",
        description: "Singapore's destination for museum-grade, investment-worthy collectible furniture.",
        image: DEFAULT_IMAGE,
      },
      contact: {
        title: "Contact — Maison Affluency",
        description: "Get in touch with Maison Affluency for inquiries about collectible furniture and design.",
        image: DEFAULT_IMAGE,
      },
    };
    const meta = sectionMeta[section] || sectionMeta.designers;
    return {
      title: meta.title,
      description: meta.description,
      image: meta.image,
      url: `${SITE_URL}/#${section}`,
    };
  }

  // ── Static routes ──────────────────────────────────────────────
  switch (clean) {
    case "/catalogue":
      return {
        title: "Catalogue — Maison Affluency | Luxury Furniture & Collectible Design",
        description:
          "Browse our curated selection of luxury furniture, lighting, and collectible design by world-renowned designers and ateliers. Price on request.",
        image: DEFAULT_IMAGE,
        url: `${SITE_URL}/catalogue`,
      };

    case "/trade/program":
      return {
        title:
          "Maison Affluency Trade Program — Exclusive Benefits for Design Professionals",
        description:
          "Dedicated Client Advisors, Designers & Ateliers Library, Project Folders, Trade Pricing, Consolidated Insured Shipping.",
        image:
          "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg,g_auto/v1772085848/intimate-dining_ux4pee.jpg",
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

  // ── Dynamic: Shared client board /board/:token ─────────────────
  const boardMatch = clean.match(/^\/board\/([^/]+)$/);
  if (boardMatch) {
    const token = boardMatch[1];
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("client_boards")
      .select("title, client_name, status")
      .eq("share_token", token)
      .neq("status", "draft")
      .single();

    if (data) {
      const clientLabel = data.client_name ? ` for ${data.client_name}` : "";
      return {
        title: `${data.title}${clientLabel} — Maison Affluency`,
        description: `Curated furniture selection${clientLabel} — review and approve pieces from Maison Affluency's collection.`,
        image: TRADE_IMAGE,
        url: `${SITE_URL}/board/${token}`,
      };
    }
  }

  // ── Dynamic: Presentation viewer /trade/presentations/:id/view ─
  const presMatch = clean.match(/^\/trade\/presentations\/([^/]+)\/view$/);
  if (presMatch) {
    const id = presMatch[1];
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("presentations")
      .select("title, description, client_name, project_name, is_published")
      .eq("id", id)
      .single();

    if (data) {
      const subtitle = [data.client_name, data.project_name]
        .filter(Boolean)
        .join(" · ");
      const desc =
        data.description ||
        `Design presentation${subtitle ? ` — ${subtitle}` : ""} by Maison Affluency.`;

      // Try to get the first slide image as the preview
      const { data: slide } = await sb
        .from("presentation_slides")
        .select("image_url")
        .eq("presentation_id", id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      return {
        title: `${data.title}${subtitle ? ` — ${subtitle}` : ""} — Maison Affluency`,
        description: desc.length > 160 ? desc.slice(0, 157) + "…" : desc,
        image: slide ? ogImage(slide.image_url) : TRADE_IMAGE,
        url: `${SITE_URL}/trade/presentations/${id}/view`,
      };
    }
  }

  // ── Dynamic: Designer/Atelier profile /trade/designers/:slug ──
  const designerMatch = clean.match(/^\/trade\/designers\/([^/]+)$/);
  if (designerMatch) {
    const slug = designerMatch[1];
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("designers")
      .select("name, specialty, biography, image_url, founder")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (data) {
      const label = data.founder && data.founder !== data.name
        ? `${data.name} — ${data.founder}`
        : data.name;
      const desc =
        data.specialty ||
        (data.biography ? data.biography.slice(0, 155) + "…" : "Discover this atelier at Maison Affluency.");
      return {
        title: `${label} — Maison Affluency`,
        description: desc.length > 160 ? desc.slice(0, 157) + "…" : desc,
        image: ogImage(data.image_url || ""),
        url: `${SITE_URL}/trade/designers/${slug}`,
      };
    }
  }

  // ── Dynamic: Gallery item deep-link /gallery?item=N&designer=... ──
  if (clean === "/gallery" || clean === "/#gallery") {
    const urlObj = new URL(req.url);
    const itemParam = urlObj.searchParams.get("item");
    const designerParam = urlObj.searchParams.get("designer");

    // Gallery flat index → metadata
    const galleryItems: { title: string; section: string; cloudinaryId: string }[] = [
      /* A Sociable Environment (0-3) */
      { title: "An Inviting Lounge Area", section: "A Sociable Environment", cloudinaryId: "bespoke-sofa_gxidtx" },
      { title: "A Sophisticated Living Room", section: "A Sociable Environment", cloudinaryId: "living-room-hero_zxfcxl" },
      { title: "Panoramic Cityscape Views", section: "A Sociable Environment", cloudinaryId: "dining-room_ey0bu5" },
      { title: "A Sun Lit Reading Corner", section: "A Sociable Environment", cloudinaryId: "IMG_2402_y3atdm" },
      /* An Intimate Setting (4-7) */
      { title: "A Dreamy Tuscan Landscape", section: "An Intimate Setting", cloudinaryId: "intimate-dining_ux4pee" },
      { title: "A Highly Customised Dining Room", section: "An Intimate Setting", cloudinaryId: "intimate-table-detail_aqxvvm" },
      { title: "A Relaxed Setting", section: "An Intimate Setting", cloudinaryId: "intimate-lounge_tf4sm1" },
      { title: "A Colourful Nook", section: "An Intimate Setting", cloudinaryId: "IMG_2133_wtxd62" },
      /* A Personal Sanctuary (8-11) */
      { title: "A Sophisticated Boudoir", section: "A Personal Sanctuary", cloudinaryId: "boudoir_ll5spn" },
      { title: "A Jewelry Box Like Setting", section: "A Personal Sanctuary", cloudinaryId: "70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq" },
      { title: "A Serene Decor", section: "A Personal Sanctuary", cloudinaryId: "bedroom-second_cyfmdj" },
      { title: "A Design Treasure Trove", section: "A Personal Sanctuary", cloudinaryId: "art-master-bronze_hf6bad" },
      /* A Calming and Dreamy Environment (12-15) */
      { title: "A Masterful Suite", section: "A Calming and Dreamy Environment", cloudinaryId: "master-suite_y6jaix" },
      { title: "Design Tableau", section: "A Calming and Dreamy Environment", cloudinaryId: "bedroom-third_ol56sx" },
      { title: "A Venitian Cocoon", section: "A Calming and Dreamy Environment", cloudinaryId: "calming-2" },
      { title: "Unique By Design Vignette", section: "A Calming and Dreamy Environment", cloudinaryId: "bedroom-alt_yk0j0d" },
      /* A Small Room with Massive Personality (16-19) */
      { title: "An Artistic Statement", section: "A Small Room with Massive Personality", cloudinaryId: "small-room-bedroom_mp8mdd" },
      { title: "Compact Elegance", section: "A Small Room with Massive Personality", cloudinaryId: "small-room-personality_wvxz6y" },
      { title: "Yellow Crystalline", section: "A Small Room with Massive Personality", cloudinaryId: "small-room-vase_s3nz5o" },
      { title: "Golden Hour", section: "A Small Room with Massive Personality", cloudinaryId: "small-room-chair_aobzyb" },
      /* Home Office with a View (20-23) */
      { title: "A Workspace of Distinction", section: "Home Office with a View", cloudinaryId: "home-office-desk_g0ywv2" },
      { title: "Refined Details", section: "Home Office with a View", cloudinaryId: "home-office-desk-2_gb1nlb" },
      { title: "Light & Focus", section: "Home Office with a View", cloudinaryId: "home-office-3_t39msw" },
      { title: "Design & Fine Art Books Corner", section: "Home Office with a View", cloudinaryId: "AffluencySG_143_1_f9iihg" },
      /* The Details Make the Design (24-27) */
      { title: "Curated Vignette", section: "The Details Make the Design", cloudinaryId: "details-section_u6rwbu" },
      { title: "The Details Make the Design", section: "The Details Make the Design", cloudinaryId: "details-console_hk6uxt" },
      { title: "Light & Texture", section: "The Details Make the Design", cloudinaryId: "details-lamp_clzcrk" },
      { title: "Craftsmanship at Every Corner", section: "The Details Make the Design", cloudinaryId: "AffluencySG_204_1_qbbpqb" },
    ];

    if (itemParam !== null) {
      const idx = parseInt(itemParam, 10);
      const item = galleryItems[idx];
      if (item) {
        const parts = ["Maison Affluency", "Interactive Gallery"];
        if (designerParam) parts.push(designerParam);
        parts.push(item.title);
        const ogTitle = parts.join(" · ");
        const desc = `${item.title} — ${item.section}. Explore the interactive gallery at Maison Affluency.`;
        const img = `https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/${item.cloudinaryId}.jpg`;

        return {
          title: ogTitle,
          description: desc,
          image: img,
          url: `${SITE_URL}/#gallery`,
        };
      }
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
  const functionBase = `${
    Deno.env.get("SUPABASE_URL") || `${url.protocol}//${url.host}`
  }/functions/v1/og-image`;
  const shareVersion = url.searchParams.get("v");
  const sharePath = encodeURI(path);
  const shareUrl = `${functionBase}?path=${sharePath}${
    shareVersion ? `&v=${encodeURIComponent(shareVersion)}` : ""
  }`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(og.title)}</title>
  <meta name="description" content="${escapeHtml(og.description)}" />
  <link rel="canonical" href="${escapeHtml(og.url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:title" content="${escapeHtml(og.title)}" />
  <meta property="og:description" content="${escapeHtml(og.description)}" />
  <meta property="og:image" content="${escapeHtml(og.image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(og.image)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="${escapeHtml(og.title)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Maison Affluency" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(og.title)}" />
  <meta name="twitter:description" content="${escapeHtml(og.description)}" />
  <meta name="twitter:image" content="${escapeHtml(og.image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(og.title)}" />
  <meta name="twitter:url" content="${escapeHtml(shareUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(redirectUrl)}">${escapeHtml(
    og.title
  )}</a>…</p>
  <script>
    window.location.replace(${JSON.stringify(redirectUrl)});
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
  </noscript>
</body>
</html>`;

  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type"
  );

  return new Response(html, { status: 200, headers });
});