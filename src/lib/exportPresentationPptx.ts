/**
 * Editable .pptx export for trade presentations.
 *
 * Mirrors the structure of the PDF export (PresentationPDF.tsx):
 *   cover slide → content slides → disclaimer slide
 * and renders the LIABILITY_ANCHOR footer on any quote-bearing slide, using
 * the same detector so PDF and PPTX stay in lockstep.
 *
 * Lazy-loaded — pptxgenjs is only imported when the user actually clicks
 * "Export as PPTX" so it stays out of the main bundle.
 */

import { LIABILITY_ANCHOR, slideIsQuoteBearing } from "./slideIsQuoteBearing";

export interface PptxProduct {
  product_name?: string;
  brand_name?: string;
  image_url?: string;
  dimensions?: string | null;
  materials?: string | null;
  trade_price_cents?: number | null;
  currency?: string | null;
  price_label?: string | null;
}

export interface PptxSlide {
  image_url?: string;
  title?: string;
  description?: string | null;
  project_name?: string | null;
  style_preset?: string | null;
  slide_type?: string;
  room_section?: string | null;
  linked_product_ids?: unknown;
  linked_quote_id?: string | null;
}

export interface PptxProgress {
  ratio: number; // 0..1
  label: string;
}

export interface PptxExportInput {
  title: string;
  clientName?: string;
  projectName?: string;
  createdAt: string;
  slides: PptxSlide[];
  onProgress?: (p: PptxProgress) => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

const parseProducts = (linked: unknown): PptxProduct[] => {
  if (!linked) return [];
  if (Array.isArray(linked)) return linked as PptxProduct[];
  if (typeof linked === "string") {
    try {
      const p = JSON.parse(linked);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatPrice = (cents: number, currency = "SGD") =>
  `${currency} ${(cents / 100).toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

const DISCLAIMER =
  "The architectural visualizations contained in this document have been generated using artificial intelligence and are intended for concept and design exploration purposes only. These renderings are indicative representations and do not constitute final design specifications. All materials, finishes, dimensions, and spatial configurations shown are approximate and remain subject to the owner's final review and approval. The architectural base layouts shown herein are for reference only and shall be verified against the latest coordinated and approved architectural drawings. Maison Affluency accepts no liability for decisions made solely on the basis of these AI-generated visualizations.";

/**
 * Build the .pptx and trigger a download. Slides are 13.333" × 7.5" (16:9)
 * so the output opens cleanly in PowerPoint, Keynote and Google Slides.
 *
 * All embedded imagery must already be provided as data-URLs (base64) or
 * absolute URLs that the pptx runtime can reach — the caller is responsible
 * for pre-fetching remote images and converting them (same pattern used by
 * the PDF export).
 */
export async function exportPresentationPptx(input: PptxExportInput): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();

  pptx.title = input.title || "Presentation";
  pptx.company = "Maison Affluency";
  pptx.author = "Maison Affluency";
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in (16:9)

  const W = 13.333;
  const H = 7.5;

  const fontHeader = "Cormorant Garamond";
  const fontBody = "Inter";

  /* ---- Cover slide ---- */
  {
    const s = pptx.addSlide();
    s.background = { color: "1A1A1A" };
    s.addShape(pptx.ShapeType.rect, {
      x: 0.35, y: 0.35, w: W - 0.7, h: H - 0.7,
      line: { color: "FFFFFF", width: 0.5, transparency: 85 },
      fill: { type: "solid", color: "1A1A1A" },
    });
    s.addText("PREPARED BY", {
      x: 0, y: 2.2, w: W, h: 0.4,
      fontFace: fontBody, fontSize: 10, color: "FFFFFF", charSpacing: 6,
      align: "center", transparency: 65,
    });
    s.addText("Maison Affluency", {
      x: 0, y: 2.6, w: W, h: 0.9,
      fontFace: fontHeader, fontSize: 44, color: "FFFFFF",
      align: "center", charSpacing: 2,
    });
    s.addShape(pptx.ShapeType.line, {
      x: W / 2 - 0.35, y: 3.7, w: 0.7, h: 0,
      line: { color: "FFFFFF", width: 0.75, transparency: 70 },
    });
    if (input.title) {
      s.addText(input.title, {
        x: 0, y: 3.9, w: W, h: 0.6,
        fontFace: fontHeader, fontSize: 24, color: "FFFFFF",
        align: "center", transparency: 15,
      });
    }
    if (input.clientName) {
      s.addText(`For ${input.clientName}`, {
        x: 0, y: 4.55, w: W, h: 0.35,
        fontFace: fontBody, fontSize: 11, color: "FFFFFF",
        align: "center", transparency: 50,
      });
    }
    if (input.projectName) {
      s.addText(input.projectName, {
        x: 0, y: 4.9, w: W, h: 0.35,
        fontFace: fontBody, fontSize: 11, color: "FFFFFF",
        align: "center", transparency: 50,
      });
    }
    s.addText(formatDate(input.createdAt), {
      x: 0, y: 5.35, w: W, h: 0.35,
      fontFace: fontBody, fontSize: 10, color: "FFFFFF",
      align: "center", transparency: 65,
    });
    s.addText(
      "This presentation contains AI-generated visualizations for concept reference only. All imagery is indicative and subject to final design review.",
      {
        x: 2, y: 6.4, w: W - 4, h: 0.6,
        fontFace: fontBody, fontSize: 8, color: "FFFFFF",
        align: "center", italic: true, transparency: 75,
      },
    );
  }

  /* ---- Content slides ---- */
  input.slides.forEach((slide, idx) => {
    const s = pptx.addSlide();
    s.background = { color: "FFFFFF" };

    const type = slide.slide_type || "image";
    const products = parseProducts(slide.linked_product_ids);

    if (type === "quote_summary") {
      /* Quote summary layout — editable table of line items */
      s.addText(slide.title || "Quote Summary", {
        x: 0.75, y: 0.55, w: W - 1.5, h: 0.7,
        fontFace: fontHeader, fontSize: 30, color: "1A1A1A", align: "center",
      });
      if (slide.room_section) {
        s.addText(slide.room_section, {
          x: 0.75, y: 1.2, w: W - 1.5, h: 0.35,
          fontFace: fontBody, fontSize: 10, color: "888888", align: "center",
        });
      }

      const rows: any[][] = [[
        { text: "Item", options: { bold: true, fontFace: fontBody, fontSize: 11, color: "1A1A1A", fill: { color: "F5F5F5" } } },
        { text: "Brand", options: { bold: true, fontFace: fontBody, fontSize: 11, color: "1A1A1A", fill: { color: "F5F5F5" } } },
        { text: "Price", options: { bold: true, fontFace: fontBody, fontSize: 11, color: "1A1A1A", fill: { color: "F5F5F5" }, align: "right" } },
      ]];
      let totalCents = 0;
      let currency = "SGD";
      products.forEach((p) => {
        const price = p.price_label
          ? p.price_label
          : p.trade_price_cents
            ? formatPrice(p.trade_price_cents, p.currency || "SGD")
            : "On request";
        if (p.trade_price_cents) totalCents += p.trade_price_cents;
        if (p.currency) currency = p.currency;
        rows.push([
          { text: p.product_name || "—", options: { fontFace: fontBody, fontSize: 11, color: "1A1A1A" } },
          { text: p.brand_name || "—", options: { fontFace: fontBody, fontSize: 10, color: "666666" } },
          { text: price, options: { fontFace: fontBody, fontSize: 11, color: "1A1A1A", align: "right" } },
        ]);
      });
      if (totalCents > 0) {
        rows.push([
          { text: "Total", options: { bold: true, fontFace: fontBody, fontSize: 12, color: "1A1A1A", fill: { color: "FAFAFA" } } },
          { text: "", options: { fill: { color: "FAFAFA" } } },
          { text: formatPrice(totalCents, currency), options: { bold: true, fontFace: fontBody, fontSize: 12, color: "1A1A1A", align: "right", fill: { color: "FAFAFA" } } },
        ]);
      }
      s.addTable(rows, {
        x: 0.75, y: 1.7, w: W - 1.5,
        colW: [(W - 1.5) * 0.55, (W - 1.5) * 0.25, (W - 1.5) * 0.2],
        border: { type: "solid", color: "E5E5E5", pt: 0.5 },
      });

      s.addText(
        "Payment terms: 60% deposit upon confirmation · 40% balance due prior to delivery.",
        { x: 0.75, y: H - 1.35, w: W - 1.5, h: 0.3, fontFace: fontBody, fontSize: 9, color: "888888", align: "center", italic: true },
      );
    } else {
      /* Default image slide (also used for product_grid / furnishing_option) */
      if (slide.image_url) {
        s.addImage({
          data: slide.image_url.startsWith("data:") ? slide.image_url : undefined,
          path: slide.image_url.startsWith("data:") ? undefined : slide.image_url,
          x: 0.5, y: 0.5, w: W - 1, h: H - 2.2,
          sizing: { type: "contain", w: W - 1, h: H - 2.2 },
        });
      }
      if (slide.title) {
        s.addText(slide.title, {
          x: 0.75, y: H - 1.65, w: W - 1.5, h: 0.45,
          fontFace: fontHeader, fontSize: 22, color: "1A1A1A", align: "center",
        });
      }
      if (slide.description) {
        s.addText(slide.description, {
          x: 1.25, y: H - 1.2, w: W - 2.5, h: 0.4,
          fontFace: fontBody, fontSize: 11, color: "666666", align: "center",
        });
      }

      // Product callouts (for product_grid slides) as editable text
      if (type === "product_grid" && products.length > 0) {
        const summary = products
          .slice(0, 6)
          .map((p) => `${p.product_name || ""} — ${p.brand_name || ""}`.trim())
          .filter(Boolean)
          .join("   ·   ");
        if (summary) {
          s.addText(summary, {
            x: 0.75, y: H - 0.85, w: W - 1.5, h: 0.3,
            fontFace: fontBody, fontSize: 9, color: "888888", align: "center",
          });
        }
      }
    }

    // Liability anchor — same detector as the PDF export
    if (slideIsQuoteBearing(slide)) {
      s.addText(LIABILITY_ANCHOR, {
        x: 0.75, y: H - 0.5, w: W - 1.5, h: 0.3,
        fontFace: fontBody, fontSize: 8, color: "999999",
        italic: true, align: "center",
      });
    }

    // Footer / page number
    s.addText("Maison Affluency", {
      x: 0.3, y: H - 0.28, w: 3, h: 0.2,
      fontFace: fontHeader, fontSize: 8, color: "CCCCCC", charSpacing: 1,
    });
    s.addText(`${idx + 2} / ${input.slides.length + 2}`, {
      x: W - 1.3, y: H - 0.28, w: 1, h: 0.2,
      fontFace: fontBody, fontSize: 7, color: "CCCCCC", align: "right",
    });
  });

  /* ---- Disclaimer slide ---- */
  {
    const s = pptx.addSlide();
    s.background = { color: "1A1A1A" };
    s.addShape(pptx.ShapeType.rect, {
      x: 0.35, y: 0.35, w: W - 0.7, h: H - 0.7,
      line: { color: "FFFFFF", width: 0.5, transparency: 85 },
      fill: { type: "solid", color: "1A1A1A" },
    });
    s.addText("Disclaimer", {
      x: 0, y: 1.5, w: W, h: 0.8,
      fontFace: fontHeader, fontSize: 28, color: "FFFFFF",
      align: "center", charSpacing: 2, transparency: 15,
    });
    s.addShape(pptx.ShapeType.line, {
      x: W / 2 - 0.35, y: 2.5, w: 0.7, h: 0,
      line: { color: "FFFFFF", width: 0.75, transparency: 70 },
    });
    s.addText(DISCLAIMER, {
      x: 2, y: 2.9, w: W - 4, h: 3.5,
      fontFace: fontBody, fontSize: 11, color: "FFFFFF",
      align: "center", transparency: 45,
    });
    s.addText(`© Maison Affluency ${new Date().getFullYear()}`, {
      x: 0, y: H - 0.9, w: W, h: 0.3,
      fontFace: fontBody, fontSize: 9, color: "FFFFFF",
      align: "center", transparency: 70,
    });
  }

  const safeName =
    (input.title || "Presentation").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-") ||
    "Presentation";
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}
