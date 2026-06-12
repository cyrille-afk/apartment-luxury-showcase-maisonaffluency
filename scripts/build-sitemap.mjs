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
const CANONICAL_HOST = "https://maisonaffluency.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// ----- Static routes (must match prerender-routes.mjs exactly) -------------

const STATIC_ROUTES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/designers", changefreq: "weekly", priority: "0.9" },
  { loc: "/collectibles", changefreq: "monthly", priority: "0.8" },
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

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${CANONICAL_HOST}${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// ----- Dynamic route loaders ------------------------------------------------

async function loadDynamicRoutes() {
  const routes = [];
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[sitemap] Supabase env vars missing — skipping dynamic routes.");
    return routes;
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
    console.warn("[sitemap] designers query failed:", err?.message ?? err);
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
    console.warn("[sitemap] journal query failed:", err?.message ?? err);
  }

  // Studios (public directory pages, not prerendered but indexable)
  try {
    const { data, error } = await supabase
      .from("featured_studios")
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
    console.warn("[sitemap] studios query failed:", err?.message ?? err);
  }

  // Trade products (public "Price on Request" pages)
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
    console.warn("[sitemap] products query failed:", err?.message ?? err);
  }

  return routes;
}

// ----- Main -----------------------------------------------------------------

async function main() {
  await mkdir(DIST, { recursive: true });

  const today = new Date().toISOString().split("T")[0];
  const dynamic = await loadDynamicRoutes();

  const staticEntries = STATIC_ROUTES.map((r) =>
    urlEntry(r.loc, today, r.changefreq, r.priority)
  );

  const dynamicEntries = dynamic.map((r) =>
    urlEntry(r.loc, r.lastmod || today, r.changefreq, r.priority)
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...dynamicEntries].join("\n")}
</urlset>`;

  const outPath = path.join(DIST, "sitemap.xml");
  await writeFile(outPath, xml, "utf8");

  const total = STATIC_ROUTES.length + dynamic.length;
  console.log(`[sitemap] wrote ${total} URLs to ${outPath}`);
}

main().catch((err) => {
  console.error("[sitemap] fatal:", err?.stack || err?.message || err);
  process.exit(1);
});
