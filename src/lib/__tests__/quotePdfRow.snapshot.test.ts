/**
 * Structural regression tests for the quote PDF row renderer
 * (`src/lib/quotePdf.ts` → `drawTable`).
 *
 * Guards three fixes that keep regressing:
 *
 *   1. Product titles must wrap on " by <Designer>" so the second line
 *      ("by Sebastian Herkner") never overflows into the QTY column.
 *   2. When a finish swatch strip renders below the image, the row must
 *      carry a "FINISHES" caption + per-tile name labels AND must NOT
 *      duplicate the same labels as "Fabric: …" / "Selected finishes: …"
 *      meta text on the right side.
 *   3. No "Shipping: …" meta line renders when the user has not chosen a
 *      shipping mode for the line.
 *
 * The PDF is rendered via the production `buildQuotePdf` codepath and then
 * parsed back with pdfjs to inspect visible text items.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildQuotePdf, type QuotePdfArgs } from "../quotePdf";

// --- jsdom shims (fetch + Image + Blob.arrayBuffer) --------------------
// `buildQuotePdf` fetches product/swatch images via window.fetch and then
// decodes them with `new Image()`. jsdom has neither wired up, so we stub
// both to return a tiny valid JPEG synchronously.
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
  public width = 40;
  public height = 40;
  public onload: (() => void) | null = null;
  public onerror: ((err?: unknown) => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeAll(() => {
  // @ts-expect-error jsdom override
  globalThis.Image = StubImage;

  // Stub fetch → return a Response-shaped object with a tiny JPEG blob.
  // (`new Response(blob)` throws in jsdom because Blob.stream is missing, so
  // we hand-roll the minimal surface fetchImageDataUrl uses: `.ok` + `.blob()`.)
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    blob: async () => makeJpegBlob(),
  })) as unknown as typeof fetch;

  // Patch FileReader.readAsDataURL to synchronously resolve with a known
  // JPEG data URL. jsdom's default readAsDataURL sometimes yields an empty
  // base64 body for programmatic Blobs, which makes fetchImageDataUrl bail
  // and the swatch strip disappear — defeating the very assertions below.
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

  if (typeof Blob.prototype.arrayBuffer !== "function") {
    (Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
      function () {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      };
  }
});

// --- Fixture -----------------------------------------------------------

const BASE_ARGS: QuotePdfArgs = {
  quoteNumber: "QU-TEST-001",
  status: "priced",
  statusLabel: "Priced",
  createdAt: new Date("2026-07-01T12:00:00Z"),
  expiryAt: new Date("2026-07-31T12:00:00Z"),
  clientName: "Test Client",
  currency: "SGD",
  lines: [
    {
      productName: "Frenchmen Street Lounge Chair by Sebastian Herkner",
      brandName: "Man of Parts",
      quantity: 1,
      unitPriceCents: 707057,
      lineTotalCents: 707057,
      imageUrl: "https://example.com/chair.jpg",
      finishSwatches: [
        { name: "Mist Oak", imageUrl: "https://example.com/mist-oak.jpg" },
        { name: "Aries Pietra", imageUrl: "https://example.com/aries-pietra.jpg" },
      ],
      finishSwatchLabel: "Mist Oak · Aries Pietra",
      fabricLabel: "Fabric: Aries Pietra",
      woodFinishLabel: null,
      // ship_mode intentionally omitted — nothing user-selected
      shipOriginCountry: null,
      shipMode: null,
      shipCbm: null,
      shipWeightKg: null,
    },
  ],
  subtotalCents: 707057,
  tradeDiscountPct: 0,
  tradeDiscountApplied: false,
  gstEnabled: false,
  gstRate: 0,
};

// --- Parser ------------------------------------------------------------

interface TextItem {
  str: string;
  x: number;
  y: number; // top-down
  pageIndex: number;
}

async function renderAndParse(args: QuotePdfArgs): Promise<TextItem[]> {
  const doc = await buildQuotePdf(args);
  const blob = doc.output("blob");
  const buf = new Uint8Array(await blob.arrayBuffer());

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("node:path");
  const url = await import("node:url");
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    url.pathToFileURL(workerPath).href;

  const pdf = await pdfjs.getDocument({
    data: buf,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const out: TextItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const raw of content.items as Array<{ str: string; transform: number[] }>) {
      out.push({
        str: raw.str,
        x: raw.transform[4],
        y: viewport.height - raw.transform[5],
        pageIndex: i,
      });
    }
  }
  return out;
}

// --- Tests -------------------------------------------------------------

describe("quotePdf row layout — regression guards", () => {
  let items: TextItem[];

  beforeAll(async () => {
    items = await renderAndParse(BASE_ARGS);
  }, 30_000);

  it("wraps the product title on ' by <Designer>' onto its own line", () => {
    const main = items.find((it) => /Frenchmen Street Lounge Chair/.test(it.str));
    const byLine = items.find((it) => /^by Sebastian Herkner/.test(it.str.trim()));
    expect(main, "main title line missing").toBeDefined();
    expect(byLine, "'by Sebastian Herkner' must render as its own line").toBeDefined();
    // The "by" line must sit below the main title, on the same left column (±2pt).
    expect(byLine!.y).toBeGreaterThan(main!.y);
    expect(Math.abs(byLine!.x - main!.x)).toBeLessThan(2);
  });

  it("renders a FINISHES caption plus each swatch name below the image", () => {
    const captions = items.filter((it) => /^Finishes:?$/i.test(it.str.trim()));
    expect(captions.length, "'Finishes:' caption missing above swatch strip").toBeGreaterThan(0);
    // pdfjs sometimes splits multi-word text into separate items — join and
    // regex-search so "Mist Oak" / "Aries Pietra" match either way.
    const joined = items.map((it) => it.str).join(" ");
    expect(joined).toMatch(/Mist\s+Oak/);
    expect(joined).toMatch(/Aries\s+Pietra/);
  });

  it("does not duplicate finish/fabric labels as right-side meta when the swatch strip renders", () => {
    // The "Fabric: Aries Pietra" and "Selected finishes: …" meta lines are
    // suppressed in favour of the swatch strip labels. Any occurrence here
    // means the duplicate the user complained about is back.
    const joined = items.map((it) => it.str).join(" | ");
    expect(joined).not.toMatch(/Fabric:\s*Aries Pietra/);
    expect(joined).not.toMatch(/Selected finishes:/i);
  });

  it("does not render a Shipping meta line when no ship_mode was chosen", () => {
    const shipping = items.find((it) => /^Shipping:/i.test(it.str.trim()));
    expect(shipping, `unexpected shipping meta rendered: ${shipping?.str}`).toBeUndefined();
  });

  it("does render Shipping meta when the user has picked a mode", async () => {
    const withShipping = await renderAndParse({
      ...BASE_ARGS,
      lines: [
        {
          ...BASE_ARGS.lines[0],
          shipOriginCountry: "DE",
          shipMode: "sea_lcl",
          shipCbm: 0.5,
          shipWeightKg: 22,
        },
      ],
    });
    const shipping = withShipping.find((it) => /^Shipping:/i.test(it.str.trim()));
    expect(shipping, "Shipping meta should render when ship_mode is set").toBeDefined();
    expect(shipping!.str).toMatch(/DE/);
    expect(shipping!.str).toMatch(/SEA LCL/);
  });
});
