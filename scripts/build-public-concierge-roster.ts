#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write
// Regenerate supabase/functions/concierge-public-stream/_roster.ts from the
// live `designers` table so the public concierge's grounding allow-list
// tracks the current roster.
//
// Usage (from the repo root):
//   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
//     deno run --allow-env --allow-net --allow-read --allow-write \
//     scripts/build-public-concierge-roster.ts
//
// The publishable key is sufficient because we only read is_published=true
// rows and the designers table is public-readable. No service role required.
//
// After running, re-run the grounding test:
//   deno test supabase/functions/concierge-public-stream/
//
// Then commit the updated _roster.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY env vars.",
  );
  Deno.exit(1);
}

const OUT_PATH = new URL(
  "../supabase/functions/concierge-public-stream/_roster.ts",
  import.meta.url,
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Pull every published designer. `.range(0, 999)` beats Supabase's default
// 1000-row cap explicitly — safer if the roster ever grows past a page.
const { data, error } = await supabase
  .from("designers")
  .select("name, specialty")
  .eq("is_published", true)
  .order("sort_order", { ascending: true, nullsFirst: false })
  .order("name", { ascending: true })
  .range(0, 999);

if (error) {
  console.error("Query failed:", error.message);
  Deno.exit(1);
}
if (!data || data.length === 0) {
  console.error("No published designers returned.");
  Deno.exit(1);
}

// Dedupe by lowercased name — the table can carry variants (e.g. two
// "Christophe Delcourt" rows with different specialties). Prefer the entry
// with a non-empty specialty.
const seen = new Map<string, { name: string; specialty: string }>();
for (const row of data as Array<{ name: string; specialty: string | null }>) {
  if (!row.name) continue;
  const key = row.name.toLowerCase();
  const specialty = (row.specialty ?? "").trim();
  const existing = seen.get(key);
  if (!existing || (!existing.specialty && specialty)) {
    seen.set(key, { name: row.name, specialty });
  }
}

const entries = [...seen.values()].sort((a, b) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

const banner = [
  "export type RosterEntry = { name: string; specialty: string };",
  "",
  "// Auto-generated from public.designers where is_published=true.",
  "// Regenerate with scripts/build-public-concierge-roster.ts.",
  "// This is the deterministic grounding list for concierge-public-stream —",
  "// the model is instructed to only cite names from here.",
  "export const ROSTER: readonly RosterEntry[] = [",
];
const body = entries.map(
  (e) => `  ${JSON.stringify(e, null, 0)},`,
);
const closer = ["] as const;", ""];
const out = [...banner, ...body, ...closer].join("\n");

await Deno.writeTextFile(OUT_PATH, out);
console.log(
  `Wrote ${entries.length} entries → ${OUT_PATH.pathname} (${out.length} bytes).`,
);
