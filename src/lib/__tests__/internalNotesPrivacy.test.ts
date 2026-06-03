/**
 * Regression guard: `internal_notes` on trade_quote_items must never be
 * surfaced through the customer-facing PDF or the procurement Excel export.
 *
 * If these tests fail, you've likely added `internal_notes` to either:
 *   - the QuotePdfLine / ProcurementLine type, or
 *   - the line-mapping inside buildPdfArgs / handleExportExcel.
 * Both leak private notes to the client. Use a separate, intentional channel.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("internal_notes export privacy", () => {
  it("QuotePdfLine type does not declare an internal_notes field", () => {
    const src = read("src/lib/quotePdf.ts");
    expect(src).not.toMatch(/internal_notes/);
  });

  it("ProcurementLine type does not declare an internal_notes field", () => {
    const src = read("src/lib/procurementExcel.ts");
    expect(src).not.toMatch(/internal_notes/);
  });

  it("QuoteDetail PDF mapper (buildPdfArgs) does not read internal_notes", () => {
    const src = read("src/components/trade/QuoteDetail.tsx");
    const start = src.indexOf("const buildPdfArgs");
    expect(start).toBeGreaterThan(-1);
    // Stop at the next top-level const declaration to bound the function body.
    const end = src.indexOf("\n  const ", start + 20);
    const body = src.slice(start, end > start ? end : start + 4000);
    expect(body).not.toMatch(/internal_notes/);
  });

  it("QuoteDetail Excel exporter (handleExportExcel) does not read internal_notes", () => {
    const src = read("src/components/trade/QuoteDetail.tsx");
    const start = src.indexOf("const handleExportExcel");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("\n  };", start);
    const body = src.slice(start, end > start ? end : start + 6000);
    expect(body).not.toMatch(/internal_notes/);
  });

  it("internal_notes is only referenced inside QuoteDetail UI editor (not in /lib exporters)", () => {
    const pdf = read("src/lib/quotePdf.ts");
    const xlsx = read("src/lib/procurementExcel.ts");
    expect(pdf + xlsx).not.toMatch(/internal_notes/);
  });
});
