#!/usr/bin/env node
// Trim meta description / og:description / twitter:description to <=160 chars
// across public/ (source of truth) and dist/ (build output).
import { promises as fs } from "node:fs";
import path from "node:path";

const MAX = 160;
const ROOTS = ["public", "dist"];

function trim(text) {
  if (text.length <= MAX) return text;
  // budget for ellipsis char
  const budget = MAX - 1;
  const slice = text.slice(0, budget);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 100 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:.\-–—]+$/, "") + "…";
}

// Match <meta ... name|property="(description|og:description|twitter:description)" ... content="...">
// Tags may be in either attr order. We'll handle both.
const TAG_RE = /<meta\b([^>]*)>/gi;

function rewrite(html) {
  let changed = false;
  const out = html.replace(TAG_RE, (full, attrs) => {
    const isDesc =
      /\b(?:name|property)\s*=\s*"(?:description|og:description|twitter:description)"/i.test(attrs);
    if (!isDesc) return full;
    const contentMatch = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!contentMatch) return full;
    const original = contentMatch[1];
    // Decode minimally for length check (HTML entities count as multi chars otherwise)
    const decoded = original
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    const encode = (s) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (original.length <= MAX) return full;
    let trimmed = trim(decoded);
    let reencoded = encode(trimmed);
    while (reencoded.length > MAX && trimmed.length > 20) {
      trimmed = trim(trimmed.replace(/…$/, "").slice(0, trimmed.length - 10));
      reencoded = encode(trimmed);
    }
    changed = true;
    const newAttrs = attrs.replace(/\bcontent\s*=\s*"[^"]*"/i, `content="${reencoded}"`);
    return `<meta${newAttrs}>`;
  });
  return { html: out, changed };
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith(".html")) yield p;
  }
}

let touched = 0;
let scanned = 0;
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    scanned++;
    const html = await fs.readFile(file, "utf8");
    const { html: next, changed } = rewrite(html);
    if (changed) {
      await fs.writeFile(file, next);
      touched++;
    }
  }
}
console.log(`[trim-meta] scanned ${scanned} html file(s); trimmed ${touched}.`);
