import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Regression guard: the AD free-download flow has been removed from the
 * trade area. This test scans the trade-facing source (pages under
 * `src/pages/Trade*` and every file under `src/components/trade/`) for
 * markers that would reintroduce a visible AD download CTA, and asserts
 * they are absent.
 *
 * If a legitimate future feature needs one of these tokens, either update
 * the allow-list at the bottom of this file or (preferred) rename the
 * symbol so intent stays explicit.
 */

const ROOT = join(process.cwd(), "src");

// Strings that indicate an AD/magazine free-download surface is being wired
// back into the trade UI. Matched case-insensitively.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /useFeaturedPublicDocument/,
  /handleTrackedCatalogueDownload/,
  /trackMagazine\.badge(?:Click|Impression)/,
  /log-magazine-event/,
  /\bfeaturedDoc\b/,
  /free[\s-]?download/i,
  /architectural\s+digest/i,
  /magazine[-_ ]?funnel/i,
];

// Files where these tokens are allowed to appear (docs, the deprecated
// no-op helper itself, this test, and the still-orphaned analytics page).
const ALLOW_LIST = new Set<string>([
  "src/test/no-ad-download-in-trade.test.ts",
  "src/lib/analytics.ts", // deprecated no-op trackMagazine + comment
  "src/hooks/useFeaturedPublicDocument.ts", // hook definition (not consumed by trade UI)
  "src/pages/TradeMagazineAnalytics.tsx", // orphaned admin page, not routed
]);

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
};

const tradeFiles = (): string[] => {
  const files: string[] = [];
  // src/pages/Trade*.tsx
  const pagesDir = join(ROOT, "pages");
  for (const entry of readdirSync(pagesDir)) {
    if (/^Trade.*\.(ts|tsx)$/.test(entry)) files.push(join(pagesDir, entry));
  }
  // everything under src/components/trade/
  const tradeComponentsDir = join(ROOT, "components", "trade");
  try {
    walk(tradeComponentsDir, files);
  } catch {
    /* directory may not exist in some checkouts */
  }
  return files;
};

describe("Trade area: AD free-download flow stays removed", () => {
  const files = tradeFiles();

  it("scans at least one trade file (sanity)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("contains no forbidden AD/magazine download markers", () => {
    const offenders: Array<{ file: string; pattern: string; line: string }> = [];

    for (const file of files) {
      const rel = relative(process.cwd(), file).split("\\").join("/");
      if (ALLOW_LIST.has(rel)) continue;

      const contents = readFileSync(file, "utf8");
      const lines = contents.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Ignore comment lines that explicitly document the removal
        // (JS `//`, JSX `{/* */}`, or block `/* */` comments).
        if (
          /(removed|discontinued|deprecated)/i.test(trimmed) &&
          /^(\/\/|\{?\/\*)/.test(trimmed)
        ) {
          return;
        }
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            offenders.push({
              file: rel,
              pattern: pattern.toString(),
              line: `${idx + 1}: ${trimmed.slice(0, 200)}`,
            });
          }
        }
      });
    }

    if (offenders.length > 0) {
      const formatted = offenders
        .map((o) => `  - ${o.file} :: ${o.pattern}\n      ${o.line}`)
        .join("\n");
      throw new Error(
        "AD free-download flow appears to be creeping back into the trade area:\n" +
          formatted +
          "\n\nIf this is intentional, update ALLOW_LIST or FORBIDDEN_PATTERNS in " +
          "src/test/no-ad-download-in-trade.test.ts.",
      );
    }

    expect(offenders).toEqual([]);
  });
});
