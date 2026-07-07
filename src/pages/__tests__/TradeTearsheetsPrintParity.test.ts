/**
 * Regression: the print/PDF HTML of the trade tearsheet must render the
 * same lead time, imperial-inches dimensions, and Selected Finishes layout
 * as the on-screen preview.
 *
 * Both surfaces must:
 *   1. Use the shared `dimensionsDisplay` / `materialsDisplay` /
 *      `leadTimeDisplay` variables (source of truth for lead time and
 *      inline metric+imperial conversion via `withImperialInline`).
 *   2. Render the Selected Finishes block (wood / fabric) BEFORE the
 *      Dimensions/Materials/Lead Time grid.
 *   3. Include wood as "Base / Wood" and fabric as "Fabric" labels.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  path.resolve(__dirname, "../TradeTearsheets.tsx"),
  "utf8",
);
// Print HTML now lives in the shared builder used by both `handlePrint`
// and the E2E PDF test — verify the same tokens there instead of inline.
const PRINT_SRC = readFileSync(
  path.resolve(__dirname, "../../lib/tearsheetPrintHtml.ts"),
  "utf8",
);
void BOTH; // reserved for future combined-scan assertions

describe("TradeTearsheets print/PDF parity with on-screen preview", () => {
  it("imports withImperialInline and derives dimensionsDisplay from it", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*withImperialInline\s*\}\s*from\s*"@\/lib\/formatDimensions"/,
    );
    expect(SRC).toMatch(
      /dimensionsDisplay\s*=\s*useMemo\(\s*\(\)\s*=>\s*withImperialInline\(selectedProduct\?\.dimensions\)/,
    );
  });

  it("derives materialsDisplay from chosenFinishes wood/fabric with the same labels used in print", () => {
    expect(SRC).toMatch(/Base \/ Wood:\s*\$\{chosenFinishes\.wood\}/);
    expect(SRC).toMatch(/Fabric:\s*\$\{chosenFinishes\.fabric\}/);
  });

  it("exposes a single leadTimeDisplay used by both grids", () => {
    expect(SRC).toMatch(/const\s+leadTimeDisplay\s*=/);
    // On-screen grid references the shared var…
    expect(SRC).toContain('["Lead Time", leadTimeDisplay]');
    // …and so does the print HTML builder.
    expect(PRINT_SRC).toContain(
      '<p class="label">Lead Time</p><p class="value">${esc(leadTimeDisplay)',
    );
  });

  it("print HTML grid uses the shared *Display variables (no raw selectedProduct fallbacks)", () => {
    // Dimensions / Materials / Lead Time cells in the print grid must all
    // use the derived *Display vars, not raw selectedProduct fields.
    expect(PRINT_SRC).toMatch(
      /<p class="label">Dimensions<\/p><p class="value"[^>]*>\$\{esc\(dimensionsDisplay\)/,
    );
    expect(PRINT_SRC).toMatch(
      /<p class="label">Materials<\/p><p class="value"[^>]*>\$\{esc\(materialsDisplay\)/,
    );
    expect(PRINT_SRC).toMatch(
      /<p class="label">Lead Time<\/p><p class="value">\$\{esc\(leadTimeDisplay\)/,
    );
  });

  it("print HTML grid uses the shared *Display variables (no raw selectedProduct fallbacks)", () => {
    // Dimensions / Materials / Lead Time cells in the print grid must all
    // use the derived *Display vars, not raw selectedProduct fields.
    expect(SRC).toMatch(
      /<p class="label">Dimensions<\/p><p class="value"[^>]*>\$\{esc\(dimensionsDisplay\)/,
    );
    expect(SRC).toMatch(
      /<p class="label">Materials<\/p><p class="value"[^>]*>\$\{esc\(materialsDisplay\)/,
    );
    expect(SRC).toMatch(
      /<p class="label">Lead Time<\/p><p class="value">\$\{esc\(leadTimeDisplay\)/,
    );
  });

  it("on-screen grid uses the same shared *Display variables in the same order", () => {
    const order = [
      '["Category", selectedProduct.category]',
      '["Dimensions", dimensionsDisplay]',
      '["Materials", materialsDisplay]',
      '["Lead Time", leadTimeDisplay]',
    ];
    let last = -1;
    for (const token of order) {
      const idx = SRC.indexOf(token);
      expect(idx, `missing on-screen row ${token}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("Selected Finishes block renders BEFORE the spec grid in the print HTML", () => {
    const finishesIdx = PRINT_SRC.indexOf(
      '<p class="label" style="margin-bottom:12px">Selected Finishes</p>',
    );
    const gridIdx = PRINT_SRC.indexOf('<div class="grid" style="margin-top:24px">');
    expect(finishesIdx).toBeGreaterThan(-1);
    expect(gridIdx).toBeGreaterThan(-1);
    expect(finishesIdx).toBeLessThan(gridIdx);
  });

  it("print HTML labels wood as 'Base / Wood' and fabric as 'Fabric', matching on-screen", () => {
    // Print builder
    expect(PRINT_SRC).toMatch(
      /<p class="label">Base \/ Wood<\/p><p class="value">\$\{esc\(chosenFinishes\.wood\)\}/,
    );
    expect(PRINT_SRC).toMatch(
      /<p class="label">Fabric<\/p><p class="value">\$\{esc\(chosenFinishes\.fabric\)\}/,
    );
    // On-screen JSX renders chosenFinishes.wood / .fabric values too.
    expect(SRC).toMatch(/\{chosenFinishes\.wood\}/);
    expect(SRC).toMatch(/\{chosenFinishes\.fabric\}/);
  });
});
