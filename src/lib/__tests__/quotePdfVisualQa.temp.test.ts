import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { buildQuotePdf, type QuotePdfArgs } from "../quotePdf";

const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z";

function makeJpegBlob(): Blob {
  const bin = atob(TINY_JPEG_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

class StubImage {
  public crossOrigin = "";
  public naturalWidth = 40;
  public naturalHeight = 40;
  public onload: (() => void) | null = null;
  public onerror: ((err?: unknown) => void) | null = null;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

test("write quote PDF visual QA fixture", async () => {
  // @ts-expect-error jsdom override
  globalThis.Image = StubImage;
  globalThis.fetch = (async () => ({ ok: true, status: 200, blob: async () => makeJpegBlob() })) as unknown as typeof fetch;
  const dataUrl = `data:image/jpeg;base64,${TINY_JPEG_B64}`;
  (FileReader.prototype as unknown as { readAsDataURL: (b: Blob) => void }).readAsDataURL =
    function (this: FileReader) {
      queueMicrotask(() => {
        Object.defineProperty(this, "result", { value: dataUrl, configurable: true });
        const evt = new Event("load");
        this.onload?.(evt as ProgressEvent<FileReader>);
        this.dispatchEvent?.(evt);
      });
    };

  const args: QuotePdfArgs = {
    quoteNumber: "QA-QUOTE-001",
    status: "priced",
    statusLabel: "Priced",
    createdAt: new Date("2026-07-09T00:00:00Z"),
    expiryAt: new Date("2026-08-09T00:00:00Z"),
    clientName: "Visual QA Client",
    currency: "SGD",
    lines: [
      {
        productName: "Praia da Granja Dining Table by Yabu Pushelberg",
        brandName: "Man of Parts",
        quantity: 1,
        unitPriceCents: 1225000,
        lineTotalCents: 1225000,
        imageUrl: "https://example.com/table.jpg",
        dimensions: "Rectangle - W 240 × D 110 × H 74 cm",
        finishSwatches: [
          { name: "Smoked Oak", imageUrl: "https://example.com/oak.jpg" },
          { name: "Aries Pietra", imageUrl: "https://example.com/stone.jpg" },
          { name: "Blackened Bronze", imageUrl: "https://example.com/bronze.jpg" },
        ],
      },
      {
        productName: "Sandy Cove Lounge Chair by Sebastian Herkner",
        brandName: "Man of Parts",
        quantity: 2,
        unitPriceCents: 480000,
        lineTotalCents: 960000,
        imageUrl: "https://example.com/chair.jpg",
        dimensions: "W 78 × D 82 × H 72 cm",
      },
    ],
    subtotalCents: 2185000,
    tradeDiscountPct: 0,
    tradeDiscountApplied: false,
    gstEnabled: false,
    gstRate: 0,
  };

  const doc = await buildQuotePdf(args);
  const blob = doc.output("blob");
  writeFileSync("/tmp/browser/quote-pdf-qa/quote.pdf", Buffer.from(await blob.arrayBuffer()));
});