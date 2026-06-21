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
// --strict makes any validation failure exit non-zero. Without it, validation
// problems are reported but bad bridges are simply skipped (never written).
const STRICT = args.has("--strict");

/**
 * Build a simple line-by-line diff of two strings for quick debugging.
 */
function diffStrings(labelA, a, labelB, b) {
  const out = [`--- ${labelA}`, `+++ ${labelB}`];
  if (a === b) {
    out.push(`  ${a}`);
  } else {
    out.push(`- ${a}`);
    out.push(`+ ${b}`);
  }
  return out.join("\n    ");
}

/**
 * Parse a generated bridge HTML and verify required tags are present and
 * internally consistent. Returns { ok, errors[] }.
 */
function validateBridge(html, expected) {
  const errors = [];
  const m = (re) => {
    const x = html.match(re);
    return x ? x[1] : null;
  };

  const title = m(/<title>([^<]*)<\/title>/i);
  if (!title || !title.trim()) errors.push("missing <title>");
  else if (!title.includes(expected.designerEsc)) errors.push(`title missing designer "${expected.designer}"`);
  else if (!title.includes(expected.titleTextEsc)) errors.push(`title missing product "${expected.titleText}"`);

  const desc = m(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!desc || !desc.trim()) errors.push("missing meta description");
  else if (desc.length > 320) errors.push(`description too long (${desc.length} chars)`);

  const robots = m(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  if (!robots || !/noindex/i.test(robots) || !/nofollow/i.test(robots))
    errors.push("robots meta is not noindex,nofollow");

  const canonical = m(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!canonical) errors.push("missing canonical");
  else if (canonical !== expected.canonical) {
    errors.push(
      `canonical mismatch:\n    ${diffStrings("expected", expected.canonical, "actual", canonical)}`
    );
  }

  const ogUrl = m(/<meta\s+property="og:url"\s+content="([^"]+)"/i);
  if (ogUrl !== expected.canonical) {
    errors.push(
      `og:url mismatch:\n    ${diffStrings("expected", expected.canonical, "actual", ogUrl ?? "(missing)")}`
    );
  }

  const ogImage = m(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (!ogImage) errors.push("missing og:image");
  else if (!/^https?:\/\//.test(ogImage)) errors.push(`og:image not absolute URL: ${ogImage}`);

  const redirect = m(/window\.location\.replace\("([^"]+)"\)/);
  if (!redirect) errors.push("missing JS redirect");
  else if (redirect !== expected.canonical) {
    errors.push(
      `redirect target mismatch:\n    ${diffStrings("expected", expected.canonical, "actual", redirect)}`
    );
  }

  return { ok: errors.length === 0, errors };
}

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

  // designer_curator_picks_public is the anon-readable view (omits price fields).
  // The view has no PostgREST FK to designers, so fetch designers separately and join in JS.
  const { data: picks, error } = await sb
    .from("designer_curator_picks_public")
    .select("id, designer_id, title, subtitle, description, image_url, gallery_images, is_hidden")
    .or("is_hidden.is.null,is_hidden.eq.false");
  const { data: designers, error: dErr } = await sb
    .from("designers")
    .select("id, name, display_name, slug");
  if (dErr) {
    console.error("Designer query failed:", dErr.message);
    process.exit(1);
  }
  const designerById = new Map((designers ?? []).map((d) => [d.id, d]));
  const data = (picks ?? []).map((p) => ({ ...p, designer: designerById.get(p.designer_id) }));



  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  let written = 0,
    skipped = 0,
    overwritten = 0,
    invalid = 0;
  const noImage = [];
  const validationFailures = [];

  for (const row of data ?? []) {
    const designerName = row.designer?.display_name || row.designer?.name;
    if (!designerName) continue;
    // Use the designer's actual DB slug as the canonical URL segment — the
    // app routes by designers.slug, NOT by slugify(name). slugify(name) is
    // only used for the bridge FILENAME so duplicate brands with different
    // slugs each get their own bridge file.
    const designerUrlSlug = row.designer?.slug || slugify(designerName);
    const designerFileSlug = slugify(designerName);
    const full = row.subtitle && String(row.subtitle).trim()
      ? `${row.title}-${row.subtitle}`
      : row.title;
    const pieceSlug = slugify(full);
    if (!designerUrlSlug || !designerFileSlug || !pieceSlug) continue;

    const filename = `${designerFileSlug}-${pieceSlug}-og.html`;
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

    // Always validate the in-memory HTML before deciding to write it.
    // Designer/title get escaped before substring-matching against the
    // generated HTML (which is also escaped — e.g. `&` → `&amp;`).
    const v = validateBridge(html, {
      canonical,
      designer: designerName,
      designerEsc: esc(designerName),
      titleText: row.title,
      titleTextEsc: esc(row.title),
    });

    if (!v.ok) {
      invalid++;
      validationFailures.push({ filename, errors: v.errors });
      continue; // skip writing — bad bridge would mislead crawlers
    }

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
  console.log(`Validation failures (skipped): ${invalid}`);
  console.log(`Missing source image (used fallback): ${noImage.length}`);

  if (validationFailures.length) {
    console.log("\nValidation failure details (first 20):");
    for (const f of validationFailures.slice(0, 20)) {
      console.log(`  ${f.filename}`);
      for (const e of f.errors) console.log(`    - ${e}`);
    }
  }

  if (!APPLY) console.log("\nDry run. Re-run with --apply to write files.");
  if (invalid > 0 && STRICT) process.exit(2);
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});
