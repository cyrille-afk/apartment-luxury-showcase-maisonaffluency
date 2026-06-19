#!/usr/bin/env node
/**
 * Pre-build: fetch all published designers from Supabase and write a static
 * JSON module to src/data/designersIndex.json.
 *
 * Why: Lovable hosting SSRs the React app on deploy. Components that depend
 * on async Supabase fetches render `null` during SSR, so client-only fetched
 * lists are invisible to crawlers. By baking the list into the bundle we let
 * <DesignerIndexLinks> render synchronously during SSR — every /designers/:slug
 * gets a real internal link from the homepage and journal index.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/data/designersIndex.json");

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
    console.warn("[designers-index] supabase env missing — writing empty list");
    await writeFile(OUT, "[]\n", "utf8");
    return;
  }

  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("designers")
    .select("slug, name")
    .eq("is_published", true)
    .eq("trade_only", false)
    .not("slug", "is", null)
    .order("name", { ascending: true })
    .range(0, 1499);

  if (error) {
    console.warn("[designers-index] query failed:", error.message);
    await writeFile(OUT, "[]\n", "utf8");
    return;
  }

  const list = (data || [])
    .filter((d) => d.slug && d.name)
    .map((d) => ({ slug: d.slug, name: d.name }));

  await writeFile(OUT, JSON.stringify(list, null, 2) + "\n", "utf8");
  console.log(`[designers-index] wrote ${list.length} designers to ${OUT}`);
}

main().catch((err) => {
  console.warn("[designers-index] fatal:", err?.message ?? err);
  process.exit(0);
});
