/**
 * Guards that the HK DAP annex (page 3) mirrors page 1 exactly:
 * same order total, no fallback FX pivot, no independent goods value.
 */
import { describe, it, expect } from "vitest";
import { buildQuotePdf, type QuotePdfArgs } from "../quotePdf";

const hkd = {
  ready: true,
  loading: false,
  fxEurHkd: 8.4746,
  fxQuoteEur: null,
  fxIsFallback: true,
  goodsHkdCents: 174526100,
  freightHkdCents: 0,
  fuelHkdCents: 0,
  insuranceHkdCents: 0,
  customsHkdCents: 0,
  handlingHkdCents: 0,
  lastMileHkdCents: 0,
  shippingHkdCents: 0,
  dutyHkdCents: 0,
  vatHkdCents: 0,
  totalHkdCents: 174526100,
  breakdown: null,
  goodsEurCents: 0,
  shippingEurCents: 0,
  totalEurCents: 0,
} as any;

const args: QuotePdfArgs = {
  quoteNumber: "QU-F05C2A",
  status: "submitted",
  statusLabel: "Submitted",
  createdAt: new Date("2026-09-18T12:00:00Z"),
  expiryAt: new Date("2026-10-18T12:00:00Z"),
  clientName: "AGNI Limited",
  clientBilling: {
    city: "Kowloon Bay",
    postalCode: "HKD",
    country: "Hong Kong",
  },
  currency: "HKD",
  lines: [
    {
      productName: "Erato Wall Light",
      brandName: "Felix Agostini",
      quantity: 4,
      unitPriceCents: 8128130,
      lineTotalCents: 32512520,
    } as any,
  ],
  subtotalCents: 32512520,
  tradeDiscountPct: 0.1,
  tradeDiscountApplied: true,
  tradeDiscountCents: 3251252,
  gstEnabled: false,
  gstRate: 0,
  extras: [{ label: "Premium packing & custom wood crates × 4", amountCents: 1582293 }],
  hkDapPage: {
    quoteRef: "QU-F05C2A",
    clientName: "AGNI Limited",
    quoteCurrency: "HKD",
    cbm: 0,
    kg: 0,
    mode: "sea_lcl",
    hkd,
  } as any,
} as any;

describe("HK DAP annex synchronisation", () => {
  it("mirrors the page-1 order total and drops fallback FX wording", async () => {
    const doc = await buildQuotePdf(args);
    const blob = doc.output("blob");
    const buf = new Uint8Array(await blob.arrayBuffer());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const path = await import("node:path");
    const url = await import("node:url");
    (pdfjs as any).GlobalWorkerOptions.workerSrc = url.pathToFileURL(
      path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href;
    const pdf = await pdfjs.getDocument({ data: buf, useSystemFonts: false }).promise;
    const last = await pdf.getPage(pdf.numPages);
    const text = (await last.getTextContent()).items.map((i: any) => i.str).join(" ");

    expect(text).toContain("308,435.61");
    expect(text).not.toContain("1,745,261");
    expect(text).not.toContain("8.4746");
    expect(text).not.toContain("fallback");
    expect(text).not.toContain("Kowloon Bay HKD");
  });
});
