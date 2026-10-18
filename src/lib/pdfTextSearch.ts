/** One run of text on a PDF page, in PDF points with a bottom-left origin. */
export type PdfTextItem = { str: string; x: number; y: number; w: number; h: number };
/** A match rectangle in PDF points with a top-left origin, ready to scale onto the rendered page. */
export type PdfMatch = { page: number; left: number; top: number; width: number; height: number };

/** Case-insensitive search across pages; every occurrence inside a text run becomes one match, in reading order. */
export function findPdfMatches(pages: { items: PdfTextItem[]; height: number }[], query: string): PdfMatch[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: PdfMatch[] = [];
  pages.forEach((pg, i) => pg.items.forEach(it => {
    const s = it.str.toLowerCase(); if (!s.length) return;
    const per = it.w / s.length; // approximate glyph width within a run
    for (let at = s.indexOf(q); at !== -1; at = s.indexOf(q, at + q.length)) {
      out.push({ page: i + 1, left: it.x + at * per, top: pg.height - it.y - it.h, width: Math.max(per * q.length, 2), height: it.h });
    }
  }));
  return out;
}
