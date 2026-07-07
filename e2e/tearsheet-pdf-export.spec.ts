import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildTearsheetPrintHtml } from "../src/lib/tearsheetPrintHtml";
import { withImperialInline } from "../src/lib/formatDimensions";
// NOTE: `formatLeadTime` normally lives in `@/components/trade/AvailabilityBadge`,
// but importing it here would drag in `@/integrations/supabase/client`, which
// depends on Vite's `import.meta.env` and is unavailable in the Playwright
// Node runtime. Inlining the tiny pure helper keeps this test hermetic while
// staying byte-identical to the production string.
function formatLeadTime(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max} wks`;
  return `${min ?? max} wks`;
}

/**
 * End-to-end verification of the trade tearsheet PDF export.
 *
 * The on-screen preview and the print/PDF are driven by the SAME derived
 * variables (`dimensionsDisplay`, `materialsDisplay`, `leadTimeDisplay`)
 * built inside `TradeTearsheets.tsx`. This test:
 *
 *   1. Reproduces the same derivations here (inches via
 *      `withImperialInline`, lead time via `formatLeadTime`, materials
 *      as "Base / Wood: … · Fabric: …").
 *   2. Feeds them into the shared `buildTearsheetPrintHtml` builder — the
 *      exact HTML that `handlePrint` writes into the popup window and
 *      sends to `window.print()`.
 *   3. Renders that HTML in headless Chromium and asks Chromium to print
 *      it to PDF (the identical code path the user's browser uses).
 *   4. Extracts the PDF's text with `pdftotext -layout` and asserts the
 *      lead time, imperial-inches conversion, and Selected Finishes
 *      layout all appear in the exported document.
 *
 * If any of those three fields fails to reach the exported PDF, this
 * test fails — regardless of whether the on-screen preview looks fine.
 */

// -- Fixture ------------------------------------------------------------------

const FIXTURE = {
  selectedProduct: {
    brand_name: "Man of Parts",
    product_name: "Sandy Cove Lounge Chair",
    category: "Seating",
    description: "Upholstered lounge chair, hand-finished in Portugal.",
    image_url: null,
    trade_price_cents: 480000,
    currency: "EUR",
  },
  chosenFinishes: {
    variant: null,
    wood: "Smoked Oak",
    woodImg: null,
    fabric: "Kvadrat Hallingdal 65 / 227",
    fabricImg: null,
  },
  // Raw DB fields — the derivations below produce the same *Display strings
  // the UI grid renders.
  rawDimensions: "H 72 cm × W 78 cm × D 82 cm",
  leadWeeksMin: 12,
  leadWeeksMax: 14,
};

const dimensionsDisplay = withImperialInline(FIXTURE.rawDimensions);
const leadTimeDisplay = formatLeadTime(FIXTURE.leadWeeksMin, FIXTURE.leadWeeksMax);
const materialsDisplay = [
  FIXTURE.chosenFinishes.wood && `Base / Wood: ${FIXTURE.chosenFinishes.wood}`,
  FIXTURE.chosenFinishes.fabric && `Fabric: ${FIXTURE.chosenFinishes.fabric}`,
]
  .filter(Boolean)
  .join(" · ");

// Sanity: the derivations must actually produce imperial + lead time output,
// otherwise the assertions below would be vacuously satisfied.
test.beforeAll(() => {
  expect(dimensionsDisplay, "withImperialInline must inject inches").toMatch(/in\b|"/);
  expect(leadTimeDisplay, "formatLeadTime must produce a weeks string").toMatch(/wks?/);
  expect(materialsDisplay).toContain("Base / Wood: Smoked Oak");
  expect(materialsDisplay).toContain("Fabric: Kvadrat Hallingdal 65 / 227");
});

// -- Test ---------------------------------------------------------------------

test("tearsheet PDF export includes lead time, imperial inches, and finishes layout", async ({
  browser,
}) => {
  const html = buildTearsheetPrintHtml({
    selectedProduct: FIXTURE.selectedProduct,
    chosenFinishes: FIXTURE.chosenFinishes,
    dimensionsDisplay,
    materialsDisplay,
    leadTimeDisplay,
    now: new Date("2026-07-07T00:00:00Z"),
  });

  // Write HTML → load with a file:// URL so images/relative paths behave
  // like the popup window flow.
  const workDir = mkdtempSync(path.join(tmpdir(), "tearsheet-pdf-e2e-"));
  const htmlPath = path.join(workDir, "tearsheet.html");
  const pdfPath = path.join(workDir, "tearsheet.pdf");
  writeFileSync(htmlPath, html, "utf8");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`file://${htmlPath}`);
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", right: "16mm", bottom: "16mm", left: "16mm" },
  });
  await ctx.close();

  // Confirm PDF landed.
  const pdfBytes = readFileSync(pdfPath);
  expect(pdfBytes.byteLength, "PDF must not be empty").toBeGreaterThan(1000);
  expect(pdfBytes.slice(0, 4).toString("ascii"), "PDF magic bytes").toBe("%PDF");

  // Extract text via poppler's pdftotext (already available in the sandbox).
  const pdfText = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });

  // CSS `letter-spacing: 0.1em/0.15em` on `.label` uppercase headings causes
  // pdftotext to insert whitespace between individual glyphs (e.g. "LEAD TIME"
  // extracts as "L EA D TI M E"). Values themselves have no letter-spacing and
  // extract verbatim. We normalize *only* for the label-presence checks; value
  // assertions still match the exact strings emitted by the on-screen preview.
  const collapse = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const flat = collapse(pdfText);

  // 1. Lead time — label present + verbatim rendered value.
  expect(flat, "PDF must contain a 'Lead Time' label").toContain(collapse("Lead Time"));
  expect(pdfText, "PDF must show the derived lead time verbatim").toContain(leadTimeDisplay!);

  // 2. Imperial inches — verbatim rendered dimensions string (whitespace-
  //    normalized to survive pdftotext's -layout line wrapping), plus a
  //    numeric inches token to guarantee the conversion actually ran.
  expect(flat, "PDF must contain the same dimensions string as the UI").toContain(
    collapse(dimensionsDisplay!),
  );
  expect(flat, "PDF must show an inches conversion").toMatch(/\d+(?:\.\d+)?in/);

  // 3. Selected Finishes layout — label + both finish labels + both values.
  expect(flat).toContain(collapse("Selected Finishes"));
  expect(flat).toContain(collapse("Base / Wood"));
  expect(pdfText).toContain("Smoked Oak");
  expect(flat).toContain(collapse("Fabric"));
  expect(pdfText).toContain("Kvadrat Hallingdal 65 / 227");

  // 4. Finishes block must precede the spec grid in reading order — guards
  //    against a future refactor that reorders sections in the PDF but
  //    leaves the on-screen preview alone.
  const finishesIdx = flat.indexOf(collapse("Selected Finishes"));
  const dimsIdx = flat.indexOf(collapse("Dimensions"));
  expect(finishesIdx).toBeGreaterThan(-1);
  expect(dimsIdx).toBeGreaterThan(-1);
  expect(finishesIdx).toBeLessThan(dimsIdx);
});
