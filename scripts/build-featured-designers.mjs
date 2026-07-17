#!/usr/bin/env node
/**
 * Pre-build: fetch the featured designers used by the /designers hero
 * (DesignersHoverHero) + their first curator-pick image, and write a static
 * JSON module to src/data/featuredDesigners.json.
 *
 * Why: on Slow-4G mobile, the hero LCP element is one of these designers'
 * background images. Waiting for Supabase to resolve after React hydrates
 * adds ~3s to LCP. By baking the URLs into the bundle, `useFeaturedDesigners`
 * can seed itself synchronously via `initialData` and the first hero image
 * starts downloading on parse.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/data/featuredDesigners.json");

// Keep this list in sync with FEATURED_GROUPS in
// src/components/DesignersHoverHero.tsx.
const FEATURED_SLUGS = [
  // Masters
  "alexander-lamont",
  "emmanuel-babled",
  "felix-agostini",
  "jean-michel-frank",
  "kiko-lopez",
  "lazzarini-pickering",
  "ozone",
  "pierre-bonnefille",
  "pierre-chareau",
  "thierry-lemaire",
  "tristan-auer",
  // Contemporary Talents
  "apparatus-studio",
  "atelier-demichelis",
  "christopher-boots",
  "delcourt-collection",
  "emmanuel-levet-stenne",
  "hamrei",
  "kerstens",
  "leo-aerts-alinea",
  "victoria-magniant",
];

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

  if (!URL || !KEY) {
    console.warn("[featured-designers] supabase env missing — writing empty list");
    await writeFile(OUT, "[]\n", "utf8");
    return;
  }

  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  const { data: designers, error } = await supabase
    .from("designers")
    .select("id, slug, name, founder, hero_image_url, image_url")
    .in("slug", FEATURED_SLUGS)
    .eq("is_published", true);

  if (error) {
    console.warn("[featured-designers] designers query failed:", error.message);
    await writeFile(OUT, "[]\n", "utf8");
    return;
  }

  const kept = (designers || []).filter((d) => d.hero_image_url || d.image_url);
  const ids = kept.map((d) => d.id);

  const firstPickByDesigner = new Map();
  if (ids.length) {
    const { data: picks, error: pErr } = await supabase
      .from("designer_curator_picks_public")
      .select("designer_id, image_url, sort_order, created_at, id")
      .in("designer_id", ids)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
    if (pErr) {
      console.warn("[featured-designers] picks query failed:", pErr.message);
    } else {
      for (const row of picks || []) {
        if (!firstPickByDesigner.has(row.designer_id) && row.image_url) {
          firstPickByDesigner.set(row.designer_id, row.image_url);
        }
      }
    }
  }

  const out = kept.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    founder: d.founder ?? null,
    hero_image_url: d.hero_image_url ?? null,
    image_url: d.image_url ?? null,
    first_pick_image_url: firstPickByDesigner.get(d.id) ?? null,
  }));

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`[featured-designers] wrote ${out.length} entries → ${path.relative(ROOT, OUT)}`);
}

main().catch(async (err) => {
  console.warn("[featured-designers] fatal:", err?.message || err);
  await writeFile(OUT, "[]\n", "utf8");
});
