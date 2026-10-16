import { describe, it, expect } from "vitest";
import { getQuoteBankTransfer } from "@/config/quoteBankTransfer";
import { buildQuotePdf, type QuotePdfArgs } from "../quotePdf";

describe("private-client GBP quotes", () => {
  it("routes GBP to the confirmed SWIFT account and GBP intermediary without offering EUR SEPA", () => {
    const instructions = getQuoteBankTransfer("GBP");
    expect(instructions.blocks).toHaveLength(1);
    expect(instructions.blocks[0].rows).toEqual(expect.arrayContaining([
      { label: "Account", value: "885111609218375" },
      { label: "SWIFT/BIC", value: "REVOSGS2" },
      { label: "Intermediary BIC", value: "BARCGB22" },
    ]));
    expect(instructions.blocks.flatMap(block => block.rows).some(row => row.label === "IBAN")).toBe(false);
  });

  it("omits trade tiers from a non-discounted PDF even with tier data supplied", async () => {
    const args: QuotePdfArgs = {
      quoteNumber: "QU-GBP-PRIVATE", status: "draft", statusLabel: "Draft",
      createdAt: new Date("2026-10-16T12:00:00Z"), expiryAt: new Date("2026-11-15T12:00:00Z"),
      currency: "GBP", lines: [], subtotalCents: 100000,
      tradeDiscountPct: 0.1, tradeDiscountApplied: false,
      tierBreakdown: [{ label: "Silver", pct: 0.1, minSpendCents: 0, active: true }],
      gstEnabled: false, gstRate: 0,
    };
    const doc = await buildQuotePdf(args);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const path = await import("node:path");
    const url = await import("node:url");
    pdfjs.GlobalWorkerOptions.workerSrc = url.pathToFileURL(path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await doc.output("blob").arrayBuffer()), useSystemFonts: false }).promise;
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      text += (await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
    }
    expect(text).not.toContain("TRADE TIERS");
    expect(text).not.toContain("Silver");
    expect(text).toContain("BARCGB22");
    expect(text).not.toContain("BARCDEFF");
    expect(text).not.toContain("EUR SEPA");
  });
});