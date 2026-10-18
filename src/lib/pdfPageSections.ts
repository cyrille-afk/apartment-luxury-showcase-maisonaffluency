export type PdfSection = "Notes" | "Finishes" | "Photos";

/** Image painted on a page, in PDF points. */
export type PageImage = { width: number; height: number };

/** Reference photos print 38 mm tall (~108 pt); finish swatches print 14 mm (~40 pt). */
const PHOTO_MIN_PT = 80;

/** Section tags for one page of a snapshot-comparison PDF, derived from its printed text and images. */
export function pageSections(text: string, images: PageImage[]): PdfSection[] {
  const t = text.toUpperCase();
  if (/PREPARED EXCLUSIVELY/.test(t)) return []; // cover page: its logo is not a reference photo
  const out: PdfSection[] = [];
  const hasNote = /STUDIO NOTE|\bNOTE \d+/.test(t);
  if (hasNote) out.push("Notes");
  const swatch = images.some(i => Math.min(i.width, i.height) < PHOTO_MIN_PT);
  if (swatch || /\bFLOOR:|\/ FINISHES\b/.test(t)) out.push("Finishes");
  if (hasNote && images.some(i => i.height >= PHOTO_MIN_PT)) out.push("Photos");
  return out;
}
