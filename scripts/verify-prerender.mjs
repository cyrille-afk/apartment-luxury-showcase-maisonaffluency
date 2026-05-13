#!/usr/bin/env node
/**
 * Verify prerendered routes serve UNIQUE <title>, <meta description>, and
 * <link rel="canonical"> — i.e. each route is not just a clone of the
 * homepage. Fails (exit 1) if any sampled route matches the homepage on any
 * of those fields, or returns non-200, or is missing a canonical.
 *
 * Usage:
 *   node scripts/verify-prerender.mjs                     # default: live site
 *   node scripts/verify-prerender.mjs https://example.com # explicit
 *   BASE_URL=https://www.maisonaffluency.com node ...     # explicit
 *   BASE_URL=http://localhost:4173 node ...               # against `vite preview`
 *   SAMPLE=20 node ...                                    # cap dynamic samples
 *
 * Source of truth for routes: same logic as scripts/prerender-routes.mjs
 * (static list + designers + journal). We re-derive instead of importing so
 * this script can run standalone against any deployment.
 */
import { createClient } from "@supabase/supabase-js";

const BASE_URL = (process.argv[2] || process.env.BASE_URL || "https://www.maisonaffluency.com").replace(/\/$/, "");
const SAMPLE = Math.max(1, parseInt(process.env.SAMPLE || "15", 10));
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "15000", 10);
const UA = "MaisonAffluency-Prerender-Verifier/1.0 (+https://www.maisonaffluency.com)";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const STATIC_PATHS = [
  "/designers",
  "/collectibles",
  "/gallery",
  "/journal",
  "/contact",
  "/trade-program",
  "/new-in",
  "/apartment-tour",
  "/studios",
  "/favorites",
];

// ---------- helpers ----------

function pickRandom(arr, n) {
  if (arr.length <= n) return arr.slice();
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function extractMeta(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  // Prefer the data-prerender canonical, fall back to first canonical.
  const prerenderCanonical = html.match(
    /<link\s+rel=["']canonical["'][^>]*data-prerender=["']true["'][^>]*href=["']([^"']+)["']/i
  ) ||
    html.match(
      /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*data-prerender=["']true["']/i
    );
  const anyCanonical = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  return {
    title: decodeEntities(titleMatch?.[1]?.trim() || ""),
    description: decodeEntities(descMatch?.[1]?.trim() || ""),
    canonical: (prerenderCanonical?.[1] || anyCanonical?.[1] || "").trim(),
    ogTitle: decodeEntities(ogTitle?.[1]?.trim() || ""),
    h1: decodeEntities((h1?.[1] || "").replace(/<[^>]+>/g, "").trim()),
  };
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const text = await res.text();
    return { status: res.status, html: text, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

async function loadDynamicPaths() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[verify] Supabase env vars missing — skipping dynamic samples.");
    return [];
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const paths = [];
  try {
    const { data } = await supabase
      .from("designers")
      .select("slug")
      .eq("is_published", true)
      .not("slug", "is", null);
    for (const r of data ?? []) if (r.slug) paths.push(`/designers/${r.slug}`);
  } catch (e) {
    console.warn("[verify] designers query failed:", e?.message ?? e);
  }
  try {
    const { data } = await supabase
      .from("journal_articles")
      .select("slug")
      .not("published_at", "is", null)
      .not("slug", "is", null);
    for (const r of data ?? []) if (r.slug) paths.push(`/journal/${r.slug}`);
  } catch (e) {
    console.warn("[verify] journal query failed:", e?.message ?? e);
  }
  return paths;
}

// ---------- main ----------

async function main() {
  console.log(`[verify] base: ${BASE_URL}`);

  // 1. Fetch homepage as the baseline duplicate signature.
  const home = await fetchHtml(`${BASE_URL}/`);
  if (home.status !== 200) {
    console.error(`[verify] FAIL: homepage returned ${home.status}`);
    process.exit(1);
  }
  const homeMeta = extractMeta(home.html);
  console.log(`[verify] homepage title: "${homeMeta.title}"`);
  if (!homeMeta.title || !homeMeta.description || !homeMeta.canonical) {
    console.error("[verify] FAIL: homepage missing title/description/canonical");
    process.exit(1);
  }

  // 2. Build sample list: all static + N random dynamic.
  const dynamic = await loadDynamicPaths();
  const sampledDynamic = pickRandom(dynamic, SAMPLE);
  const paths = [...STATIC_PATHS, ...sampledDynamic];
  for (const mustCheck of [
    "/designers/cc-tapis",
    "/designers/formafantasma-cc-tapis",
    "/designers/massimo-giorgetti-cc-tapis",
  ]) {
    if (!paths.includes(mustCheck)) paths.push(mustCheck);
  }
  console.log(
    `[verify] checking ${paths.length} routes (${STATIC_PATHS.length} static + ${sampledDynamic.length} dynamic of ${dynamic.length})`
  );

  const failures = [];
  const seenDescriptions = new Map();
  let ok = 0;

  for (const p of paths) {
    const url = `${BASE_URL}${p}`;
    let result;
    try {
      result = await fetchHtml(url);
    } catch (e) {
      failures.push({ path: p, reason: `fetch error: ${e?.message ?? e}` });
      continue;
    }
    if (result.status !== 200) {
      failures.push({ path: p, reason: `HTTP ${result.status}` });
      continue;
    }
    const meta = extractMeta(result.html);
    const reasons = [];

    if (!meta.title) reasons.push("missing <title>");
    else if (meta.title === homeMeta.title) reasons.push(`title duplicates homepage`);

    if (!meta.description) reasons.push("missing <meta description>");
    else if (meta.description === homeMeta.description)
      reasons.push("description duplicates homepage");
    else if (seenDescriptions.has(meta.description))
      reasons.push(`description duplicates ${seenDescriptions.get(meta.description)}`);
    else seenDescriptions.set(meta.description, p);

    if (!meta.canonical) reasons.push("missing <link rel=canonical>");
    else if (meta.canonical === homeMeta.canonical)
      reasons.push(`canonical duplicates homepage (${meta.canonical})`);
    else if (!meta.canonical.endsWith(p))
      reasons.push(`canonical (${meta.canonical}) does not end with ${p}`);

    if (reasons.length) {
      failures.push({ path: p, reason: reasons.join("; "), meta });
    } else {
      ok++;
      if (process.env.VERBOSE) {
        console.log(`  ✓ ${p} — "${meta.title.slice(0, 60)}…"`);
      }
    }
  }

  console.log(`\n[verify] ${ok}/${paths.length} routes passed.`);
  if (failures.length) {
    console.error(`\n[verify] ${failures.length} FAILURES:`);
    for (const f of failures) {
      console.error(`  ✗ ${f.path} — ${f.reason}`);
      if (f.meta) {
        console.error(`      title:       ${JSON.stringify(f.meta.title)}`);
        console.error(`      canonical:   ${f.meta.canonical}`);
        console.error(`      description: ${JSON.stringify(f.meta.description.slice(0, 80))}`);
      }
    }
    process.exit(1);
  }

  console.log("[verify] OK — all sampled routes serve unique prerendered metadata.");
}

main().catch((err) => {
  console.error("[verify] fatal:", err?.stack || err?.message || err);
  process.exit(1);
});
