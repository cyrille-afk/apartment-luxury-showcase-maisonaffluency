#!/usr/bin/env node
/**
 * Pre-build: fetch the same trimmed catalog manifest the `catalog-manifest`
 * edge function serves, and ship it as a static JSON asset at
 * `public/catalog-manifest.json`.
 *
 * Why: on first paint, `fetchCatalogManifest` can hit the static file at the
 * site origin (served from the same CDN as the HTML, warm cache) with ZERO
 * database dependency. The edge function is kept as a runtime fallback so
 * newly-added picks show up within the 5-min SWR window without a redeploy.
 *
 * Mirrors the query in supabase/functions/catalog-manifest/index.ts — keep
 * the two column lists in sync.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/catalog-manifest.json");

const PICK_COLUMNS = [
  "id",
  "title",
  "subtitle",
  "image_url",
  "hover_image_url",
  "materials",
  "dimensions",
  "lead_time",
  "origin",
  "category",
  "subcategory",
  "pdf_url",
  "designer_id",
  "variant_placeholder",
  "base_axis_label",
  "top_axis_label",
  "tags",
  "sort_order",
  "created_at",
].join(",");

try {
  const envText = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });

  const empty = { generated_at: new Date().toISOString(), picks: [], designers: [] };

  if (!URL || !KEY) {
    console.warn("[catalog-manifest] supabase env missing — writing empty manifest");
    await writeFile(OUT, JSON.stringify(empty) + "\n", "utf8");
    return;
  }

  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  const [picksRes, designersRes] = await Promise.all([
    supabase
      .from("designer_curator_picks_public")
      .select(PICK_COLUMNS)
      .not("image_url", "is", null),
    supabase
      .from("designers")
      .select("id, name, slug, display_name, source, founder, era, country, is_published, trade_only")
      .eq("is_published", true)
      .eq("trade_only", false),
  ]);

  if (picksRes.error || designersRes.error) {
    console.warn(
      "[catalog-manifest] query failed:",
      picksRes.error?.message || designersRes.error?.message,
    );
    await writeFile(OUT, JSON.stringify(empty) + "\n", "utf8");
    return;
  }

  const body = {
    generated_at: new Date().toISOString(),
    picks: picksRes.data ?? [],
    designers: designersRes.data ?? [],
  };

  await writeFile(OUT, JSON.stringify(body) + "\n", "utf8");
  console.log(
    `[catalog-manifest] wrote picks=${body.picks.length} designers=${body.designers.length} → ${path.relative(ROOT, OUT)}`,
  );
}

main().catch(async (err) => {
  console.warn("[catalog-manifest] fatal:", err?.message || err);
  await writeFile(
    OUT,
    JSON.stringify({ generated_at: new Date().toISOString(), picks: [], designers: [] }) + "\n",
    "utf8",
  );
});
