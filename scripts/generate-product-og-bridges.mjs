#!/usr/bin/env node
/**
 * Generate per-product OG bridge HTML files at public/share/og/.
 *
 * For every unhidden row in designer_curator_picks (joined to designers),
 * writes a static bridge:
 *
 *   public/share/og/{designerSlug}-{pieceSlug}-og.html
 *
 * Each bridge carries baked OG tags + a JS redirect to the canonical
 * /designers/{designerSlug}/{pieceSlug} page. Crawlers (WhatsApp, iMessage,
 * Slack, LinkedIn, etc.) scrape the bridge; real browsers redirect.
 *
 * Slug rules MUST match src/lib/whatsapp-share.ts `slugify`.
 *
 * Usage:
 *   node scripts/generate-product-og-bridges.mjs            # dry run
 *   node scripts/generate-product-og-bridges.mjs --apply    # write files
 *   node scripts/generate-product-og-bridges.mjs --apply --overwrite
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/share/og");

const SITE = "https://www.maisonaffluency.com";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://dcrauiygaezoduwdjmsm.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0.COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const OVERWRITE = args.has("--overwrite");

// ── slugify: must match src/lib/whatsapp-share.ts exactly ─────────────────────
const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[éèêë]/g, "e")
    .replace(/[àâäáã]/g, "a")
    .replace(/[ùûüú]/g, "u")
    .replace(/[ôöóõ]/g, "o")
    .replace(/[îïí]/g, "i")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/ř/g, "r")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const OG_TRANSFORM = "w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg";
const OG_FALLBACK =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";

function toOgImage(url) {
  if (!url || typeof url !== "string") return OG_FALLBACK;
  if (!url.includes("res.cloudinary.com")) return url; // non-Cloudinary: pass through
  if (/\/upload\/[^/]*[wch]_\d+/.test(url)) {
    return url.replace(/\/upload\/[^/]+\//, `/upload/${OG_TRANSFORM}/`);
  }
  return url.replace("/upload/", `/upload/${OG_TRANSFORM}/`);
}

function pickImage(row) {
  const gallery = Array.isArray(row.gallery_images) ? row.gallery_images : [];
  const first = gallery.find((g) => typeof g === "string" && g.trim()) ||
    (gallery[0] && typeof gallery[0] === "object" ? gallery[0].url : null);
  return first || row.image_url || null;
}

function buildHtml({ title, designer, description, canonical, ogImage }) {
  const headline = `${title} by ${designer} — Maison Affluency`;
  const desc =
    (description ?? "").replace(/\s+/g, " ").trim().slice(0, 300) ||
    `${title} by ${designer} — curated for collectors and interior designers by Maison Affluency.`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(headline)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="${SITE}/favicon.ico" sizes="any" />

    <meta property="og:type" content="product" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Maison Affluency" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${esc(headline)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(headline)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${ogImage}" />
  </head>
  <body>
    <script>if(!/bot|crawl|spider|WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Pinterest|Googlebot/i.test(navigator.userAgent)){window.location.replace("${canonical}");}</script>
  </body>
</html>
`;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const existing = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith("-og.html")));

  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  // Pull all unhidden picks with the joined designer display name.
  const { data, error } = await sb
    .from("designer_curator_picks")
    .select(
      "id, title, subtitle, description, image_url, gallery_images, is_hidden, designer:designers!inner(name, display_name)"
    )
    .or("is_hidden.is.null,is_hidden.eq.false");

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  let written = 0,
    skipped = 0,
    overwritten = 0;
  const noImage = [];

  for (const row of data ?? []) {
    const designerName = row.designer?.display_name || row.designer?.name;
    if (!designerName) continue;
    const designerSlug = slugify(designerName);
    const full = row.subtitle && String(row.subtitle).trim()
      ? `${row.title}-${row.subtitle}`
      : row.title;
    const pieceSlug = slugify(full);
    if (!designerSlug || !pieceSlug) continue;

    const filename = `${designerSlug}-${pieceSlug}-og.html`;
    if (existing.has(filename) && !OVERWRITE) {
      skipped++;
      continue;
    }

    const canonical = `${SITE}/designers/${designerSlug}/${pieceSlug}`;
    const rawImg = pickImage(row);
    if (!rawImg) noImage.push(filename);
    const ogImage = toOgImage(rawImg);

    const html = buildHtml({
      title: row.title,
      designer: designerName,
      description: row.description,
      canonical,
      ogImage,
    });

    if (APPLY) {
      writeFileSync(resolve(OUT_DIR, filename), html, "utf8");
    }
    if (existing.has(filename)) overwritten++;
    else written++;
  }

  console.log(`Picks scanned: ${data?.length ?? 0}`);
  console.log(`Existing bridges: ${existing.size}`);
  console.log(`To write (new): ${written}`);
  console.log(`To overwrite:   ${overwritten}`);
  console.log(`Skipped existing: ${skipped}`);
  console.log(`Missing source image (used fallback): ${noImage.length}`);
  if (!APPLY) console.log("\nDry run. Re-run with --apply to write files.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
