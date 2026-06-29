#!/usr/bin/env node
/**
 * Visual regression snapshot for the Designers Directory.
 *
 * Verifies after any styling change:
 *  1. Parent brand cards remain ~double the width of designer cards.
 *  2. Parent and designer card heights are aligned within a small tolerance.
 *  3. Caption visibility rules hold:
 *       - Designers NOT in the HIDE_PARENT_LABEL_SLUGS set show their parent label.
 *       - Designers IN that set do not show a parent label on the directory card.
 *  4. A full-page screenshot is saved per run, and a diff vs the committed baseline
 *     is written so reviewers can eyeball regressions.
 *
 * Usage:
 *   node scripts/visual-regression/designers-directory.mjs            # compare vs baseline
 *   node scripts/visual-regression/designers-directory.mjs --update   # refresh baseline
 *
 * Requires the dev server on http://localhost:8080 and Playwright + pngjs + pixelmatch.
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, '../../tests/visual/baselines');
const OUTPUT_DIR = path.resolve(__dirname, '../../tests/visual/output');
const BASELINE_FILE = path.join(BASELINE_DIR, 'designers-directory.png');
const CURRENT_FILE = path.join(OUTPUT_DIR, 'designers-directory.current.png');
const DIFF_FILE = path.join(OUTPUT_DIR, 'designers-directory.diff.png');

const BASE_URL = process.env.VR_BASE_URL ?? 'http://localhost:8080';
const UPDATE_BASELINE = process.argv.includes('--update');
const HEIGHT_TOLERANCE_PX = 6;
const PIXEL_DIFF_THRESHOLD = 0.02; // 2% of pixels may differ

const POSITIVE_LABEL_SLUGS = ['sam-accoceberry']; // expect visible parent label
const HIDDEN_LABEL_SLUGS = [
  'lazzarini-pickering',
  'jean-michel-frank',
  'eileen-gray',
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

async function run() {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}/designers`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="designer-card"], a[href^="/designers/"]', { timeout: 15000 });
  // Allow lazy images / layout to settle.
  await page.waitForTimeout(1500);

  // 1 + 2. Measure first parent vs first designer card.
  const measurements = await page.evaluate(() => {
    const parent = document.querySelector('[data-card-kind="parent"]');
    const designer = document.querySelector('[data-card-kind="designer"]');
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    return { parent: rect(parent), designer: rect(designer) };
  });

  if (!measurements.parent || !measurements.designer) {
    fail('Could not locate [data-card-kind="parent"] and [data-card-kind="designer"] anchors. Ensure the directory cards expose these attributes.');
  } else {
    const ratio = measurements.parent.width / measurements.designer.width;
    if (ratio < 1.85 || ratio > 2.15) {
      fail(`Parent/designer width ratio out of range: ${ratio.toFixed(2)} (expected ~2.0)`);
    } else {
      pass(`Parent card width is ${ratio.toFixed(2)}× the designer card.`);
    }
    const dh = Math.abs(measurements.parent.height - measurements.designer.height);
    if (dh > HEIGHT_TOLERANCE_PX) {
      fail(`Parent/designer height drift ${dh.toFixed(1)}px exceeds ${HEIGHT_TOLERANCE_PX}px tolerance.`);
    } else {
      pass(`Parent/designer heights aligned within ${dh.toFixed(1)}px.`);
    }
  }

  // 3. Caption visibility per slug list.
  for (const slug of POSITIVE_LABEL_SLUGS) {
    const visible = await page.locator(`[data-designer-slug="${slug}"] [data-parent-label]`).first().isVisible().catch(() => false);
    if (!visible) fail(`Expected parent label visible for "${slug}".`);
    else pass(`Parent label visible for "${slug}".`);
  }
  for (const slug of HIDDEN_LABEL_SLUGS) {
    const count = await page.locator(`[data-designer-slug="${slug}"] [data-parent-label]`).count().catch(() => 0);
    if (count > 0) fail(`Parent label should be hidden for "${slug}" but ${count} element(s) found.`);
    else pass(`Parent label hidden for "${slug}".`);
  }

  // 4. Screenshot: clip to the directory section to keep snapshot stable.
  const section = page.locator('[data-testid="designers-directory"]').first();
  const target = (await section.count()) ? section : page;
  await target.screenshot({ path: CURRENT_FILE });

  if (UPDATE_BASELINE || !fs.existsSync(BASELINE_FILE)) {
    fs.copyFileSync(CURRENT_FILE, BASELINE_FILE);
    pass(`Baseline ${UPDATE_BASELINE ? 'updated' : 'created'} at ${path.relative(process.cwd(), BASELINE_FILE)}.`);
  } else {
    const baseline = PNG.sync.read(fs.readFileSync(BASELINE_FILE));
    const current = PNG.sync.read(fs.readFileSync(CURRENT_FILE));
    if (baseline.width !== current.width || baseline.height !== current.height) {
      fail(`Snapshot dimensions changed (baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}). Re-run with --update if intentional.`);
    } else {
      const diff = new PNG({ width: baseline.width, height: baseline.height });
      const diffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
      fs.writeFileSync(DIFF_FILE, PNG.sync.write(diff));
      const ratio = diffPixels / (baseline.width * baseline.height);
      if (ratio > PIXEL_DIFF_THRESHOLD) {
        fail(`Visual diff ${(ratio * 100).toFixed(2)}% exceeds ${(PIXEL_DIFF_THRESHOLD * 100).toFixed(0)}% threshold. See ${path.relative(process.cwd(), DIFF_FILE)}.`);
      } else {
        pass(`Visual diff within tolerance (${(ratio * 100).toFixed(2)}%).`);
      }
    }
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
