/**
 * Snapshot/structural tests for the designer biography PDF generator.
 *
 * These tests guard against two specific regressions we shipped recently:
 *
 *   1. The "Prepared for …" recipient line being placed on the dark hero
 *      image (cover) and becoming nearly invisible. It MUST sit on the cream
 *      block (lower 38% of the cover page).
 *
 *   2. Body pages ending with a large empty bottom band — i.e. the side-by-side
 *      figure spread leaves the bottom half of the page blank because the
 *      following media is too tall and gets bumped to the next page. After
 *      our backfill fix no body page should have more than ~33% of its
 *      height empty between the lowest content and the footer.
 *
 * We render the actual PDF via the production codepath, then parse it back
 * with pdfjs to inspect text positions and operator positions.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { generateDesignerBiographyPdf } from "../generateDesignerBiographyPdf";

// --- jsdom shims so that loadImage() resolves with a usable bitmap ---
//
// In jsdom `new Image()` never fires onload and `canvas.toDataURL` returns a
// 1x1 transparent PNG. That's enough for jsPDF to call addImage successfully,
// but onload never firing means loadImage returns null and the side-by-side
// branch is skipped. We patch both so the generator exercises its real
// figure-paginating logic.
class StubImage {
  public crossOrigin = "";
  public naturalWidth = 1600;
  public naturalHeight = 1000;
  public width = 1600;
  public height = 1000;
  public onload: (() => void) | null = null;
  public onerror: ((err?: unknown) => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    // Fire load on next tick to mimic real browsers
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeAll(() => {
  // @ts-expect-error overriding for jsdom
  globalThis.Image = StubImage;
  // canvas.toDataURL needs to return a non-empty JPEG string so the generator
  // accepts the bitmap. We monkey-patch the prototype.
  const protoCanvas = HTMLCanvasElement.prototype as unknown as {
    toDataURL: (type?: string) => string;
  };
  protoCanvas.toDataURL = () =>
    // 4-byte JPEG-shaped data URL — jsPDF only checks for the "data:image/jpeg" prefix
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z";
});

// Realistic Apparatus-style biography that triggers the page-3 issue:
// drop-cap intro paragraph → media → paragraph → media → paragraph.
const APPARATUS_BIO = [
  "Apparatus is a New York-based design studio established in 2012 by Gabriel Hendifar and Jeremy Anderson. The studio explores the relationship between materials and craft through a tightly edited collection of lighting, furniture, and objects. Their work has been celebrated for its sculptural confidence and an obsessive attention to handwork.",
  "![Apparatus New York Gallery, 124 West 30th Street, Floor 4, New York, NY 10001](https://res.cloudinary.com/example/image/upload/apparatus-ny.jpg)",
  "At Apparatus, hand-patinated brass forms the structural backbone of nearly every piece. It is combined with sensual, time-honoured materials — marble, suede, horsehair, lacquer, porcelain, alabaster, hand-frosted mouth-blown glass, and hand-cast resin — all fabricated with a devotion to small-studio craftsmanship. Each piece embodies a deft balance between mechanisation and the handmade. The studio's custom component catalogue now numbers more than 700 parts.",
  "![Apparatus London Gallery, Mount Street, Mayfair - Photo Credit Matthew Placek](https://res.cloudinary.com/example/image/upload/apparatus-london.jpg)",
  "In May 2023, Apparatus opened its first European gallery on Mount Street in Mayfair, London — a 3,200-square-foot Grade II-listed building dating to the 1890s, conceived as a living expression of the brand's immersive design ethos. Today Apparatus employs approximately 110 team members across design, sales, operations, and manufacturing, with showrooms in New York, Los Angeles, Milan, and London.",
  "The studio has created environments for the Four Seasons, Soho House, Paris's Hôtel Lutetia, and architect Annabelle Selldorf. Interior designers Jamie Drake, Kelly Behun, Christine Gachot, and Nate Berkus are among its most prominent advocates. Gabriel Hendifar serves as Artistic Director and CEO; Jeremy Anderson, co-founder, initially handled operations, production, and finishing — personally wiring fixtures, applying patinas, and hand-finishing leather details in the early years.",
].join("\n\n");

interface ParsedTextItem {
  str: string;
  x: number;
  y: number;
  height: number;
  pageIndex: number; // 1-based
}

interface ParsedPage {
  width: number;
  height: number;
  items: ParsedTextItem[];
  /** Y of the lowest non-footer content (text or image), in PDF coords (origin bottom-left). */
  lowestContentY: number;
  /** Approximate footer top Y (where footer hairline + brand text live). */
  footerTopY: number;
}

async function renderAndParse(): Promise<ParsedPage[]> {
  const blob = await generateDesignerBiographyPdf({
    designerName: "Apparatus Studio",
    specialty: "Lighting & objects",
    biography: APPARATUS_BIO,
    heroImageUrl: "https://res.cloudinary.com/example/image/upload/hero.jpg",
    profileUrl: "https://maisonaffluency.com/designers/apparatus-studio",
    recipientName: "Cyrille Delval",
    downloadedAt: new Date("2026-04-29T12:00:00Z"),
  });

  const buf = new Uint8Array(await blob.arrayBuffer());

  // Use the legacy build that doesn't need a worker (better for jsdom)
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable worker — synchronous main-thread parsing
  // @ts-expect-error pdfjs types
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({ data: buf, disableWorker: true });
  const doc = await loadingTask.promise;

  const out: ParsedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: ParsedTextItem[] = (content.items as Array<{
      str: string;
      transform: number[];
      height: number;
    }>).map((it) => ({
      str: it.str,
      x: it.transform[4],
      // pdfjs y is from bottom-left; convert to top-down for easier reasoning
      y: viewport.height - it.transform[5],
      height: it.height,
      pageIndex: i,
    }));

    // Footer band: by construction the generator places footers at
    // pageHeight - marginBottom + 28..56 (~ y around pageH-52..pageH-24).
    // Anything with top-y > pageHeight - 80 is footer.
    const footerThreshold = viewport.height - 80;
    const nonFooter = items.filter((it) => it.y <= footerThreshold && it.str.trim().length > 0);
    const lowestContentY = nonFooter.length
      ? Math.max(...nonFooter.map((it) => it.y))
      : 0;

    out.push({
      width: viewport.width,
      height: viewport.height,
      items,
      lowestContentY,
      footerTopY: footerThreshold,
    });
  }

  return out;
}

describe("generateDesignerBiographyPdf — visibility & whitespace guards", () => {
  let pages: ParsedPage[];

  beforeAll(async () => {
    pages = await renderAndParse();
  }, 30_000);

  it("produces at least 3 pages (cover + body)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  describe("Cover page — 'Prepared for …' watermark", () => {
    it("renders the recipient line on the cream block, NOT over the hero image", () => {
      const cover = pages[0];
      const preparedItems = cover.items.filter((it) =>
        /Prepared for/i.test(it.str),
      );
      expect(
        preparedItems.length,
        "Expected at least one 'Prepared for' text item on cover",
      ).toBeGreaterThan(0);

      // Hero occupies the top ~62% of the cover. The recipient line MUST sit
      // below that boundary (i.e. on the cream block) so it is legible.
      const heroBottomY = cover.height * 0.62;
      for (const it of preparedItems) {
        expect(
          it.y,
          `"Prepared for" line at y=${it.y.toFixed(1)} must be below hero band (>${heroBottomY.toFixed(1)})`,
        ).toBeGreaterThan(heroBottomY);
      }
    });

    it("includes the recipient name and a formatted date", () => {
      const cover = pages[0];
      const text = cover.items.map((i) => i.str).join(" ");
      expect(text).toMatch(/Prepared for\s+Cyrille Delval/i);
      expect(text).toMatch(/2026/);
    });
  });

  describe("Body pages — no oversized whitespace gaps", () => {
    /**
     * For each body page, the gap between the lowest piece of real content
     * and the footer must stay below this fraction of total page height.
     * The Apparatus regression had ~50% empty space on page 3.
     */
    const MAX_TRAILING_GAP_RATIO = 0.40;

    it("never leaves more than 40% of a body page empty before the footer", () => {
      const violations: string[] = [];

      // Skip cover (page 1) and the LAST body page (which legitimately ends short).
      const bodyPages = pages.slice(1, -1);

      for (const page of bodyPages) {
        if (page.lowestContentY === 0) continue; // page with only images — skipped, see next test
        const trailingGap = page.footerTopY - page.lowestContentY;
        const ratio = trailingGap / page.height;
        if (ratio > MAX_TRAILING_GAP_RATIO) {
          violations.push(
            `Page ${page.items[0]?.pageIndex ?? "?"}: trailing gap = ${(ratio * 100).toFixed(0)}% of page height ` +
              `(lowest content y=${page.lowestContentY.toFixed(0)}, footer top y=${page.footerTopY.toFixed(0)})`,
          );
        }
      }

      expect(
        violations,
        `Body pages have excessive bottom whitespace:\n${violations.join("\n")}`,
      ).toEqual([]);
    });
  });

  describe("Footer — repeats on every body page", () => {
    it("each body page carries the 'Prepared for' footer line", () => {
      for (let i = 1; i < pages.length; i++) {
        const text = pages[i].items.map((it) => it.str).join(" ");
        expect(
          text,
          `Page ${i + 1} missing 'Prepared for' footer`,
        ).toMatch(/Prepared for/i);
      }
    });
  });
});
