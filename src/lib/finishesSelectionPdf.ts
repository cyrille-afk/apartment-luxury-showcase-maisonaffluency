/**
 * Fabric & Finishes Selection PDF
 * -------------------------------
 * Builds a landscape, gallery-style swatch sheet for a single product:
 *   • Title  — "Fabric and Finishes Selection"
 *   • Subtitle — product / supplier line
 *   • Grid of swatch tiles (image + name), grouped by supplier/category
 *   • Maison Affluency logo centred at the bottom of every page
 *
 * Pure client-side via jsPDF so no print dialog chrome is injected.
 */
import jsPDF from "jspdf";
import affluencyLogoUrl from "@/assets/affluency-quote-logo.jpg";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";

export interface FinishSwatch {
  name: string;
  imageUrl?: string | null;
  /** e.g. "Skandilock", "Fabric", "Wood" — used for the section subtitle. */
  group?: string | null;
}

export interface FinishesPdfArgs {
  productName: string;
  brandName?: string | null;
  swatches: FinishSwatch[];
}

const FG = [26, 26, 26] as const;
const MUTED = [110, 110, 110] as const;
const RULE = [214, 212, 206] as const;

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const optimized = optimizeImageUrl(url, "w_600,h_600,c_fill,q_auto:good,f_jpg");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(optimized, { mode: "cors", signal: controller.signal });
    window.clearTimeout(timeout);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Group swatches while preserving their incoming order. */
function groupSwatches(swatches: FinishSwatch[]) {
  const groups: { label: string; items: FinishSwatch[] }[] = [];
  for (const s of swatches) {
    const label = (s.group || "").trim();
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }
  return groups;
}

export async function buildFinishesSelectionPdf(args: FinishesPdfArgs): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 54;
  const contentW = pageW - 2 * M;

  const [logo, ...images] = await Promise.all([
    fetchImageDataUrl(affluencyLogoUrl),
    ...args.swatches.map((s) => (s.imageUrl ? fetchImageDataUrl(s.imageUrl) : Promise.resolve(null))),
  ]);

  const withImages = args.swatches.map((s, i) => ({ ...s, data: images[i] }));

  const COLS = 5;
  const GAP = 22;
  const tile = Math.min((contentW - GAP * (COLS - 1)) / COLS, 128);
  const gridW = tile * COLS + GAP * (COLS - 1);
  const gridX = (pageW - gridW) / 2;
  const captionH = 24;
  const footerH = 74;

  const drawFooter = () => {
    if (!logo) return;
    const w = 50;
    try {
      doc.addImage(logo, "JPEG", (pageW - w) / 2, pageH - footerH + 12, w, w, undefined, "FAST");
    } catch {
      /* logo is decorative — never block the export */
    }
  };

  const drawHeader = (continued: boolean) => {
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.setFont("times", "normal");
    doc.setFontSize(28);
    doc.text("Fabric and Finishes Selection", pageW / 2, M + 14, { align: "center" });

    const sub = [args.brandName, args.productName].filter(Boolean).join(" — ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(continued ? `${sub} (continued)` : sub, pageW / 2, M + 36, { align: "center" });
    return M + 64;
  };

  let y = drawHeader(false);

  const drawGroupLabel = (label: string, continued: boolean) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${label.toUpperCase()}${continued ? " (CONT.)" : ""}`, gridX, y + 6, { charSpace: 1.4 });
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.5);
    doc.line(gridX, y + 13, gridX + gridW, y + 13);
    y += 28;
  };

  const newPage = (groupLabel: string) => {
    drawFooter();
    doc.addPage();
    y = drawHeader(true);
    if (groupLabel) drawGroupLabel(groupLabel, true);
  };

  for (const group of groupSwatches(withImages as unknown as FinishSwatch[])) {
    const items = group.items as (FinishSwatch & { data?: string | null })[];
    const rowH = tile + captionH + 16;

    if (group.label) {
      if (y + 28 + rowH > pageH - footerH) newPage("");
      drawGroupLabel(group.label, false);
    }

    for (let i = 0; i < items.length; i += COLS) {
      if (y + rowH > pageH - footerH) newPage(group.label);
      const row = items.slice(i, i + COLS);
      row.forEach((s, c) => {
        const x = gridX + c * (tile + GAP);
        if (s.data) {
          try {
            doc.addImage(s.data, "JPEG", x, y, tile, tile, undefined, "FAST");
          } catch {
            /* skip broken swatch imagery */
          }
        } else {
          doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
          doc.setLineWidth(0.5);
          doc.rect(x, y, tile, tile);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(FG[0], FG[1], FG[2]);
        const lines = doc.splitTextToSize(s.name || "", tile).slice(0, 2);
        lines.forEach((ln: string, li: number) =>
          doc.text(ln, x + tile / 2, y + tile + 13 + li * 10, { align: "center" }),
        );
      });
      y += rowH;
    }
  }


  drawFooter();
  return doc;
}

export function finishesPdfFileName(productName: string) {
  const slug = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "product"}-fabric-and-finishes.pdf`;
}
