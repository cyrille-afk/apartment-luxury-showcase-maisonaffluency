#!/usr/bin/env node
/**
 * Delete OG bridge HTML files for a trade-only (or removed) designer/atelier.
 *
 * Usage:
 *   node scripts/delete-og-bridge.mjs <slug> [<slug> ...]
 *   node scripts/delete-og-bridge.mjs --dry-run <slug>
 *
 * Removes any matching files under:
 *   public/designers/<slug>-og*.html
 *   public/ateliers/<slug>-og*.html
 *
 * After deletion, submit a removal request in Google Search Console for the
 * canonical URL(s) for fastest takedown.
 */
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const slugs = args.filter((a) => a !== "--dry-run");

if (slugs.length === 0) {
  console.error("Usage: node scripts/delete-og-bridge.mjs [--dry-run] <slug> [<slug> ...]");
  process.exit(1);
}

const DIRS = ["public/designers", "public/ateliers"];

let total = 0;
for (const slug of slugs) {
  const re = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-og(?:-[a-z0-9]+)?\\.html$`, "i");
  let matched = 0;
  for (const dir of DIRS) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!re.test(file)) continue;
      const full = join(dir, file);
      matched++;
      total++;
      if (dryRun) {
        console.log(`[dry-run] would delete ${full}`);
      } else {
        unlinkSync(full);
        console.log(`deleted ${full}`);
      }
    }
  }
  if (matched === 0) console.log(`(no bridge files matched for "${slug}")`);
}

console.log(`\n${dryRun ? "[dry-run] " : ""}${total} file(s) ${dryRun ? "would be" : ""} removed.`);
if (!dryRun && total > 0) {
  console.log("\nNext: submit a removal request in Google Search Console for the canonical URL(s).");
}
