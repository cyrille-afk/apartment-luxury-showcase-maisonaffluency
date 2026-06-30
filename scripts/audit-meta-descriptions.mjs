#!/usr/bin/env node
// Audit all rendered meta descriptions for length.
// Google typically truncates snippets at ~155-160 characters, so any
// description that exceeds 160 chars is flagged for review.
//
// Scans:
//   - dist/ (post-build prerendered shells)
//   - public/ (static bridge and OG pages)
//
// Runs as part of the build pipeline. Exits non-zero if violations are found.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_DESCRIPTION_LENGTH = 160;

const DESCRIPTION_META_RE = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/gi;
const DESCRIPTION_META_RE_REVERSE = /<meta\s+content=["']([^"']*)["']\s+name=["']description["']/gi;

async function* walkHtml(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkHtml(full);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        yield full;
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

function extractDescriptions(html) {
  const results = [];
  for (const re of [DESCRIPTION_META_RE, DESCRIPTION_META_RE_REVERSE]) {
    let match;
    while ((match = re.exec(html)) !== null) {
      results.push(match[1]);
    }
  }
  return [...new Set(results)];
}

async function auditDirectory(dir, label) {
  const violations = [];
  for await (const file of walkHtml(dir)) {
    const html = await readFile(file, "utf8");
    const descriptions = extractDescriptions(html);
    for (const desc of descriptions) {
      if (desc.length > MAX_DESCRIPTION_LENGTH) {
        violations.push({
          file: path.relative(ROOT, file),
          length: desc.length,
          excess: desc.length - MAX_DESCRIPTION_LENGTH,
          snippet: desc.slice(0, 120) + (desc.length > 120 ? "…" : ""),
        });
      }
    }
  }
  if (violations.length > 0) {
    console.error(`\n[audit-meta] ${label}: ${violations.length} meta description(s) exceed ${MAX_DESCRIPTION_LENGTH} characters:`);
    for (const v of violations) {
      console.error(`  - ${v.file} (${v.length} chars, +${v.excess})`);
      console.error(`    "${v.snippet}"`);
    }
  }
  return violations;
}

async function main() {
  const distDir = path.join(ROOT, "dist");
  const publicDir = path.join(ROOT, "public");

  const distExists = await stat(distDir).then((s) => s.isDirectory()).catch(() => false);
  const publicExists = await stat(publicDir).then((s) => s.isDirectory()).catch(() => false);

  let allViolations = [];

  if (distExists) {
    allViolations.push(...await auditDirectory(distDir, "dist"));
  } else {
    console.warn("[audit-meta] dist/ not found — skipping post-build check.");
  }

  if (publicExists) {
    allViolations.push(...await auditDirectory(publicDir, "public"));
  }

  if (allViolations.length === 0) {
    console.log(`[audit-meta] All meta descriptions are ≤ ${MAX_DESCRIPTION_LENGTH} characters.`);
    process.exit(0);
  } else {
    console.error(`[audit-meta] Found ${allViolations.length} total violation(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[audit-meta] fatal:", err?.stack || err?.message || err);
  process.exit(1);
});
