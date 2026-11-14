/**
 * Client-ready mood board PDF: cover line + image grid with piece/maker
 * captions and optional retail-only room budget. Downloads via blob URL.
 */
import { formatPdfMoney } from "./pdfFormatting";
import type { MoodCurrency, MoodRoomType } from "./moodBoardBudget";

export interface MoodBoardPdfContext {
  logoUrl?: string | null;
  /** Present only for Mood Board covers, not other shared tearsheet exports. */
  cover?: { propertyName: string; heroImageUrl: string };
  roomType: MoodRoomType;
  currency: MoodCurrency;
  allocated: number;
  target: number | null;
  unpriced: number;
  pending?: boolean;
  locale?: string | null;
}

export function moodBoardPdfBudget(context: MoodBoardPdfContext) {
  const money = (cents: number) => formatPdfMoney(cents, context.currency, context.locale);
  return {
    room: { living: "Living room", dining: "Dining room", bedroom: "Bedroom", office: "Office" }[context.roomType],
    allocated: context.pending ? "Unconfirmed" : `${money(context.allocated)}${context.unpriced ? " (partial)" : ""}`,
    target: context.target == null ? "Not set" : money(context.target),
    status: context.pending ? "Pricing unconfirmed - budget incomplete" : context.unpriced
      ? `${context.unpriced} piece${context.unpriced === 1 ? "" : "s"} awaiting pricing - budget incomplete`
      : context.target == null ? "" : `${money(Math.abs(context.target - context.allocated))} ${context.allocated > context.target ? "over target" : "remaining"}`,
  };
}
export interface MoodBoardExportItem {
  product_name?: string | null;
  brand_name?: string | null;
  image_url?: string | null;
  /** Optional finish/notes line (never prices). */
  detail?: string | null;
}

const INK: [number, number, number] = [33, 33, 31];
const MUTED: [number, number, number] = [87, 107, 103];

async function toDataUrl(url: string, max = 900): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const bitmap = new Image();
    try {
      await new Promise<void>((resolve, reject) => { bitmap.onload = () => resolve(); bitmap.onerror = () => reject(new Error("Image unavailable")); bitmap.src = objectUrl; });
    } finally { URL.revokeObjectURL(objectUrl); }
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

export function moodBoardFileName(title: string): string {
  const slug = (title || "mood-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mood-board";
  return `${slug}.pdf`;
}

export async function buildMoodBoardPdf(title: string, items: MoodBoardExportItem[], studioName?: string | null, context?: MoodBoardPdfContext): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const cols = items.length <= 4 ? 2 : items.length <= 9 ? 3 : 4;
  const gap = 12;
  const cell = (W - M * 2 - gap * (cols - 1)) / cols;
  const caption = items.some((i) => i.detail) ? 36 : 26;
  const logo = context?.logoUrl ? await toDataUrl(context.logoUrl) : null;
  if (context?.logoUrl && !logo) throw new Error("Studio logo unavailable");
  const summary = context ? moodBoardPdfBudget(context) : null;
  const startY = context ? 112 : M + 28;

  if (context?.cover) {
    const hero = await toDataUrl(context.cover.heroImageUrl, 2000);
    if (!hero) throw new Error("Cover image unavailable");
    if (logo) {
      const ratio = Math.min(180 / logo.w, 42 / logo.h);
      doc.addImage(logo.data, "PNG", M, 26, logo.w * ratio, logo.h * ratio);
    } else if (studioName) {
      doc.setFont("times", "normal");
      doc.setFontSize(18);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(studioName, W - M * 2)[0], M, 48);
    }
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("MOOD BOARD", W - M, 48, { align: "right" });
    doc.setFont("times", "normal");
    doc.setFontSize(30);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(context.cover.propertyName.trim() || title, W - M * 2);
    // Fit long property names rather than truncate them.
    const titleSize = Math.min(30, 52 / Math.max(1, lines.length));
    doc.setFontSize(titleSize);
    doc.text(lines, M, 96, { lineHeightFactor: 1.1 });
    const imageY = 140;
    const imageH = 310;
    const ratio = Math.min((W - M * 2) / hero.w, imageH / hero.h);
    doc.addImage(hero.data, "PNG", M + (W - M * 2 - hero.w * ratio) / 2, imageY + (imageH - hero.h * ratio) / 2, hero.w * ratio, hero.h * ratio);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (summary) {
      doc.text(`${summary.room} · ${context.currency} · ${items.length} pieces`, M, 486);
      doc.setFontSize(9);
      doc.text(`Allocated: ${summary.allocated}    /    Target: ${summary.target}`, M, 507);
      doc.setTextColor(...MUTED);
      doc.setFontSize(8);
      if (summary.status) doc.text(summary.status, M, 523);
    }
    doc.addPage();
  }

  const header = () => {
    doc.setFont("times", "normal");
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    const heading = doc.splitTextToSize(title || "Mood Board", W - 2 * M - 190)[0] || "Mood Board";
    doc.text(heading, M, M + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    if (logo) {
      const ratio = Math.min(140 / logo.w, 36 / logo.h);
      doc.addImage(logo.data, "PNG", W - M - logo.w * ratio, 23, logo.w * ratio, logo.h * ratio);
    }
    doc.text(`${studioName ? `${studioName} · ` : ""}${items.length} piece${items.length === 1 ? "" : "s"}`, W - M, logo ? 72 : M + 8, { align: "right", maxWidth: 300 });
    if (summary && context) {
      doc.setTextColor(...INK);
      doc.setFontSize(10);
      doc.text(`${summary.room} · ${context.currency}`, M, 70);
      doc.setFontSize(9);
      doc.text(`Allocated: ${summary.allocated}    /    Target: ${summary.target}`, M, 86);
      doc.setTextColor(...MUTED);
      doc.setFontSize(8);
      if (summary.status) doc.text(summary.status, M, 99);
    }
  };
  header();
  let x = M;
  let y = startY;
  const images = await Promise.all(items.map((i) => (i.image_url ? toDataUrl(i.image_url) : Promise.resolve(null))));
  items.forEach((item, idx) => {
    if (y + cell * 0.75 + caption > H - M) {
      doc.addPage();
      header();
      x = M;
      y = startY;
    }
    const img = images[idx];
    const boxH = cell * 0.75;
    if (img) {
      const ratio = Math.min(cell / img.w, boxH / img.h);
      const w = img.w * ratio;
      const h = img.h * ratio;
      doc.addImage(img.data, "PNG", x + (cell - w) / 2, y + (boxH - h) / 2, w, h);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(item.product_name || "", cell)[0] || "", x, y + boxH + 11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(item.brand_name || "", cell)[0] || "", x, y + boxH + 21);
    if (item.detail) {
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(item.detail, cell)[0] || "", x, y + boxH + 31);
    }
    if ((idx + 1) % cols === 0) {
      x = M;
      y += boxH + caption + gap;
    } else {
      x += cell + gap;
    }
  });
  return doc.output("blob");
}
