/**
 * Client-ready mood board PDF: cover line + image grid with piece/maker
 * captions. No prices are ever included. Downloads via blob URL.
 */
export interface MoodBoardExportItem {
  product_name?: string | null;
  brand_name?: string | null;
  image_url?: string | null;
  /** Optional finish/notes line (never prices). */
  detail?: string | null;
}

const INK: [number, number, number] = [33, 33, 31];
const MUTED: [number, number, number] = [87, 107, 103];

async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const max = 900;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

export function moodBoardFileName(title: string): string {
  const slug = (title || "mood-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mood-board";
  return `${slug}.pdf`;
}

export async function buildMoodBoardPdf(title: string, items: MoodBoardExportItem[], studioName?: string | null): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const cols = items.length <= 4 ? 2 : items.length <= 9 ? 3 : 4;
  const gap = 12;
  const cell = (W - M * 2 - gap * (cols - 1)) / cols;
  const caption = items.some((i) => i.detail) ? 36 : 26;

  const header = () => {
    doc.setFont("times", "normal");
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text(title || "Mood Board", M, M + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${studioName ? `${studioName} · ` : ""}${items.length} piece${items.length === 1 ? "" : "s"}`, W - M, M + 8, { align: "right" });
  };
  header();
  let x = M;
  let y = M + 28;
  const images = await Promise.all(items.map((i) => (i.image_url ? toDataUrl(i.image_url) : Promise.resolve(null))));
  items.forEach((item, idx) => {
    if (y + cell * 0.75 + caption > H - M) {
      doc.addPage();
      header();
      x = M;
      y = M + 28;
    }
    const img = images[idx];
    const boxH = cell * 0.75;
    if (img) {
      const ratio = Math.min(cell / img.w, boxH / img.h);
      const w = img.w * ratio;
      const h = img.h * ratio;
      doc.addImage(img.data, "JPEG", x + (cell - w) / 2, y + (boxH - h) / 2, w, h);
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
