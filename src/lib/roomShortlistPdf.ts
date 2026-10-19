import { jsPDF } from 'jspdf';
import type { RoomShortlistItem } from './roomShortlist';

const JADE: [number, number, number] = [22, 58, 52];
const GOLD: [number, number, number] = [176, 141, 87];
const INK: [number, number, number] = [34, 34, 34];
const MUTED: [number, number, number] = [120, 120, 120];

export function shortlistPdfFilename(title: string) {
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'room-shortlist'}.pdf`;
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  } catch { return null; }
}

export async function buildRoomShortlistPdf(opts: { title: string; roomLabel: string; items: RoomShortlistItem[]; date?: Date }): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18;
  const date = (opts.date || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Cover
  doc.setFillColor(...JADE); doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.rect(10, 10, W - 20, H - 20);
  doc.setTextColor(...GOLD); doc.setFont('times', 'normal'); doc.setFontSize(11);
  doc.text('MAISON AFFLUENCY', W / 2, 40, { align: 'center', charSpace: 2 });
  doc.setTextColor(255, 255, 255); doc.setFontSize(30);
  doc.text(doc.splitTextToSize(opts.title, W - 50), W / 2, 125, { align: 'center' });
  doc.setDrawColor(...GOLD); doc.line(W / 2 - 20, 150, W / 2 + 20, 150);
  doc.setFontSize(12); doc.setTextColor(...GOLD);
  doc.text(`${opts.roomLabel} · ${opts.items.length} ${opts.items.length === 1 ? 'piece' : 'pieces'}`, W / 2, 162, { align: 'center' });
  doc.setTextColor(220, 220, 220); doc.setFontSize(10); doc.text(date, W / 2, 172, { align: 'center' });
  doc.setFontSize(9); doc.text('maisonaffluency.com', W / 2, H - 22, { align: 'center' });

  const images = await Promise.all(opts.items.map(i => (i.image_url ? loadImage(i.image_url) : Promise.resolve(null))));
  // Two pieces per page
  const slotH = (H - 2 * M - 12) / 2;
  opts.items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.addPage();
      doc.setTextColor(...GOLD); doc.setFont('times', 'normal'); doc.setFontSize(8);
      doc.text('MAISON AFFLUENCY', M, 12, { charSpace: 1.5 });
      doc.text(opts.title, W - M, 12, { align: 'right' });
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.2); doc.line(M, 14, W - M, 14);
    }
    const top = M + 2 + (idx % 2) * (slotH + 6);
    const imgBox = { x: M, y: top, w: 80, h: slotH - 4 };
    doc.setFillColor(246, 244, 240); doc.rect(imgBox.x, imgBox.y, imgBox.w, imgBox.h, 'F');
    const img = images[idx];
    if (img) {
      const s = Math.min((imgBox.w - 6) / img.w, (imgBox.h - 6) / img.h);
      const w = img.w * s, h = img.h * s;
      doc.addImage(img.data, 'JPEG', imgBox.x + (imgBox.w - w) / 2, imgBox.y + (imgBox.h - h) / 2, w, h);
    }
    const tx = M + 88, tw = W - M - tx;
    let y = top + 6;
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(String(idx + 1).padStart(2, '0') + (item.category ? `  ·  ${item.category.toUpperCase()}` : ''), tx, y, { charSpace: 0.8 });
    y += 9; doc.setTextColor(...INK); doc.setFont('times', 'normal'); doc.setFontSize(17);
    const nameLines = doc.splitTextToSize(item.product_name, tw); doc.text(nameLines, tx, y); y += nameLines.length * 7;
    doc.setTextColor(...GOLD); doc.setFontSize(11); doc.text(item.brand_name, tx, y); y += 10;
    const row = (label: string, value?: string | null) => {
      if (!value) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(label.toUpperCase(), tx, y, { charSpace: 0.6 }); y += 4.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(value, tw).slice(0, 4); doc.text(lines, tx, y); y += lines.length * 4.2 + 3;
    };
    row('Dimensions', item.dimensions); row('Materials', item.materials); row('Lead time', item.lead_time);
    row('Price', 'Price upon Request');
    if (item.public_url) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...JADE);
      doc.textWithLink('View piece online', tx, Math.min(y + 2, top + slotH - 6), { url: item.public_url });
    }
  });

  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(`${p - 1} / ${pages - 1}`, W - M, H - 8, { align: 'right' });
    doc.text('Curated by Maison Affluency · concierge@maisonaffluency.com', M, H - 8);
  }
  return doc.output('blob');
}
