#!/usr/bin/env node
/**
 * Post-build sitemap generator: emit dist/sitemap.xml containing every
 * public indexable route — all prerendered shells plus additional public
 * pages (studios, trade products, etc.).
 *
 * This guarantees that the sitemap is always in sync with what was actually
 * prerendered, because it runs immediately after prerender-routes.mjs and
 * derives routes from the same source-of-truth queries.
 *
 * The sitemap points to canonical URLs on https://maisonaffluency.com.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

// Load .env manually (Node doesn't do this automatically; Vite does for client bundle only)
try {
  const envText = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env not present in some environments — fall back to process.env
}
const DIST = path.join(ROOT, "dist");
// Single global production origin. Every <loc> in the tree is built from this
// exact prefix — never a relative path, never a staging/preview host, never www.
const BASE_URL = "https://maisonaffluency.com";

// ----- Domain lock ----------------------------------------------------------
// A sitemap may only ever be generated for the production domain. If the build
// is running for a staging/preview/development target (any *.lovable.app
// branch, a Netlify/Vercel preview, or a local dev build), emit an EMPTY
// urlset so a preview deployment can never feed Google a tree of URLs that
// will 404 once the sandbox rotates.
const DEPLOY_TARGET = (
  process.env.SITEMAP_SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.DEPLOY_PRIME_URL ||
  process.env.DEPLOY_URL ||
  process.env.URL ||
  process.env.VERCEL_URL ||
  ""
).toLowerCase();

const IS_NON_PRODUCTION_TARGET =
  DEPLOY_TARGET !== "" &&
  !/(^|\/\/|\.)maisonaffluency\.com(\/|$)/.test(DEPLOY_TARGET);
// Guardrail: the live catalogue is ~1,000 URLs. Anything far below that means a
// failed/partial query, not a genuinely shrunken catalogue.
const MIN_DYNAMIC_ROUTES = Number(process.env.SITEMAP_MIN_ROUTES ?? 300);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// ----- Static routes (must match prerender-routes.mjs exactly) -------------

const STATIC_ROUTES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/designers", changefreq: "weekly", priority: "0.9" },
  // /collectibles is trade-gated during soft launch — omit from sitemap.
  { loc: "/gallery", changefreq: "monthly", priority: "0.8" },
  { loc: "/journal", changefreq: "weekly", priority: "0.9" },
  { loc: "/contact", changefreq: "monthly", priority: "0.7" },
  { loc: "/trade-program", changefreq: "monthly", priority: "0.8" },
  { loc: "/trade/spec-sheet", changefreq: "weekly", priority: "0.8" },
  { loc: "/new-in", changefreq: "weekly", priority: "0.9" },
  { loc: "/apartment-tour", changefreq: "monthly", priority: "0.8" },
  { loc: "/studios", changefreq: "weekly", priority: "0.8" },
];

// ----- XML helpers ----------------------------------------------------------

const escapeXml = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Hard guard: a route must be a clean, absolute-from-root canonical path with
// no host, no protocol, no query and no trailing slash. Anything else would
// emit a URL that bounces through a redirect (or points off-domain).
function assertCanonicalPath(loc) {
  if (typeof loc !== "string" || !loc.startsWith("/")) {
    throw new Error(`[sitemap] non-canonical route (must start with "/"): ${loc}`);
  }
  if (/^\/\//.test(loc) || /https?:/i.test(loc) || /lovable\.app/i.test(loc)) {
    throw new Error(`[sitemap] route must not carry a host or protocol: ${loc}`);
  }
  if (loc.length > 1 && loc.endsWith("/")) {
    throw new Error(`[sitemap] route must not end with a trailing slash: ${loc}`);
  }
  return loc;
}

function urlEntry(loc, lastmod, changefreq, priority) {
  const path = assertCanonicalPath(loc);
  return `  <url>
    <loc>${BASE_URL}${escapeXml(path)}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
    }
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// ----- Dynamic route loaders ------------------------------------------------

async function loadDynamicRoutes() {
  const routes = [];
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Supabase env vars missing — refusing to emit a sitemap without live records."
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Designers (same filter as prerender-routes.mjs)
  try {
    const { data, error } = await supabase
      .from("designers")
      .select("slug, updated_at")
      .eq("is_published", true)
      .eq("trade_only", false)
      .not("slug", "is", null);
    if (error) throw error;
    for (const d of data ?? []) {
      if (!d.slug) continue;
      routes.push({
        loc: `/designers/${d.slug}`,
        lastmod: (d.updated_at ?? "").split("T")[0],
        changefreq: "monthly",
        priority: "0.7",
      });
    }
    console.log(`[sitemap] designers: ${data?.length ?? 0}`);
  } catch (err) {
    throw new Error(`designers query failed: ${err?.message ?? err}`);
  }

  // Journal articles (same filter as prerender-routes.mjs)
  try {
    const { data, error } = await supabase
      .from("journal_articles")
      .select("slug, updated_at")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .not("slug", "is", null);
    if (error) throw error;
    for (const a of data ?? []) {
      if (!a.slug) continue;
      routes.push({
        loc: `/journal/${a.slug}`,
        lastmod: (a.updated_at ?? "").split("T")[0],
        changefreq: "monthly",
        priority: "0.7",
      });
    }
    console.log(`[sitemap] journal: ${data?.length ?? 0}`);
  } catch (err) {
    throw new Error(`journal query failed: ${err?.message ?? err}`);
  }

  // Studios (public directory pages, not prerendered but indexable)
  try {
    const { data, error } = await supabase
      .from("featured_studios_public")
      .select("slug, updated_at")
      .eq("is_published", true)
      .not("slug", "is", null);
    if (error) throw error;
    for (const s of data ?? []) {
      if (!s.slug) continue;
      routes.push({
        loc: `/studios/${s.slug}`,
        lastmod: (s.updated_at ?? "").split("T")[0],
        changefreq: "monthly",
        priority: "0.7",
      });
    }
    console.log(`[sitemap] studios: ${data?.length ?? 0}`);
  } catch (err) {
    throw new Error(`studios query failed: ${err?.message ?? err}`);
  }

  // Trade products (public "Price upon Request" pages)
  // Read from a sitemap-only projection. The source trade_products table is
  // intentionally protected by RLS, so public builds must not query it directly.
  try {
    const products = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("sitemap_products")
        .select("id, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      products.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    for (const p of products) {
      if (!p.id) continue;
      routes.push({
        loc: `/product/${p.id}`,
        lastmod: (p.updated_at ?? "").split("T")[0],
        changefreq: "weekly",
        priority: "0.6",
      });
    }
    console.log(`[sitemap] products: ${products.length}`);
  } catch (err) {
    throw new Error(`products query failed: ${err?.message ?? err}`);
  }

  return routes;
}

// ----- Main -----------------------------------------------------------------

async function main() {
  await mkdir(DIST, { recursive: true });

  if (IS_NON_PRODUCTION_TARGET) {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    await writeFile(path.join(DIST, "sitemap.xml"), emptyXml, "utf8");
    console.log(
      `[sitemap] non-production target (${DEPLOY_TARGET}) — wrote an empty sitemap; only ${BASE_URL} may publish a URL tree.`
    );
    return;
  }

  const dynamic = await loadDynamicRoutes();

  // No <lastmod> for static routes: the build date is not a page-specific
  // content timestamp and would mislead crawlers on every deploy.
  const staticEntries = STATIC_ROUTES.map((r) =>
    urlEntry(r.loc, null, r.changefreq, r.priority)
  );

  // Never ship a sitemap that silently collapsed: a near-empty tree would drop
  // thousands of live URLs out of Google's index in one deploy.
  if (dynamic.length < MIN_DYNAMIC_ROUTES) {
    throw new Error(
      `only ${dynamic.length} dynamic routes resolved (minimum ${MIN_DYNAMIC_ROUTES}) — aborting instead of publishing a truncated sitemap.`
    );
  }

  const seen = new Set(STATIC_ROUTES.map((r) => r.loc));
  const dynamicEntries = dynamic
    .filter((r) => {
      if (!r.loc || seen.has(r.loc)) return false;
      seen.add(r.loc);
      return true;
    })
    // Only a real, record-specific updated_at may become <lastmod>.
    .map((r) => urlEntry(r.loc, r.lastmod || null, r.changefreq, r.priority));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...dynamicEntries].join("\n")}
</urlset>`;

  const outPath = path.join(DIST, "sitemap.xml");
  await writeFile(outPath, xml, "utf8");

  const total = staticEntries.length + dynamicEntries.length;
  console.log(`[sitemap] wrote ${total} URLs to ${outPath}`);
}

main().catch((err) => {
  console.error("[sitemap] fatal:", err?.stack || err?.message || err);
  process.exit(1);
});
