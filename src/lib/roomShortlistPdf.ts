import { jsPDF } from 'jspdf';
import { shortlistCover, shortlistContact, type RoomShortlistItem, type RoomShortlistCover } from './roomShortlist';
import { formatPdfDate } from './pdfFormatting';

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
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  } catch { return null; }
}

export async function buildRoomShortlistPdf(opts: { title: string; roomLabel: string; items: RoomShortlistItem[]; date?: Date; cover?: RoomShortlistCover }): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18;
  const date = formatPdfDate(opts.date || new Date(), 'en-GB');
  const fonts = await Promise.all(['/fonts/pdf/Inter-Light.ttf', '/fonts/pdf/CormorantGaramond-Regular.ttf'].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('PDF font unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }));
  doc.addFileToVFS('Inter.ttf', fonts[0]); doc.addFont('Inter.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Cormorant.ttf', fonts[1]); doc.addFont('Cormorant.ttf', 'Cormorant', 'normal');
  const cover = shortlistCover(opts.cover);
  let coverY = 78;
  const coverPage = () => {
    doc.setFillColor(...JADE); doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.rect(10, 10, W - 20, H - 20);
    doc.setTextColor(...GOLD); doc.setFont('Cormorant', 'normal'); doc.setFontSize(11);
    doc.text('MAISON AFFLUENCY', W / 2, 40, { align: 'center', charSpace: 2 });
    doc.setFont('Inter', 'normal'); doc.setFontSize(9); doc.setTextColor(220, 220, 220);
    doc.text('maisonaffluency.com', W / 2, H - 22, { align: 'center' });
  };
  const coverText = (text: string, size: number, heading = false) => {
    if (!text.trim()) return;
    doc.setFont(heading ? 'Cormorant' : 'Inter', 'normal'); doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text.trim(), W - 56);
    const lineH = size * 0.3528 * 1.4;
    for (const line of lines) {
      if (coverY + lineH > 252) { doc.addPage(); coverPage(); coverY = 68; doc.setFont(heading ? 'Cormorant' : 'Inter', 'normal'); doc.setFontSize(size); }
      doc.setTextColor(245, 245, 245); doc.text(line, W / 2, coverY, { align: 'center' }); coverY += lineH;
    }
    coverY += 8;
  };

  // Flow cover content instead of fixed baselines; long introductions continue intact.
  coverPage();
  coverText(cover.projectTitle || opts.title, 30, true);
  if (cover.projectTitle.trim()) coverText(opts.title, 14, true);
  coverText(`${opts.roomLabel} · ${opts.items.length} ${opts.items.length === 1 ? 'piece' : 'pieces'}`, 11);
  if (cover.clientName.trim()) coverText(`Prepared for ${cover.clientName.trim()}`, 12);
  if (cover.introduction.trim()) {
    coverY += 5;
    coverText(cover.introduction, 11);
  }
  coverText(date, 9);
  const coverPages = doc.getNumberOfPages();

  const images = await Promise.all(opts.items.map(i => (i.image_url ? loadImage(i.image_url) : Promise.resolve(null))));
  // Two pieces per page
  const slotH = (H - 2 * M - 12) / 2;
  opts.items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.addPage();
      doc.setTextColor(...GOLD); doc.setFont('Cormorant', 'normal'); doc.setFontSize(8);
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
    doc.setTextColor(...MUTED); doc.setFont('Inter', 'normal'); doc.setFontSize(8);
    doc.text(String(idx + 1).padStart(2, '0') + (item.category ? `  ·  ${item.category.toUpperCase()}` : ''), tx, y, { charSpace: 0.8 });
    y += 9; doc.setTextColor(...INK); doc.setFont('Cormorant', 'normal'); doc.setFontSize(17);
    const nameLines = doc.splitTextToSize(item.product_name, tw); doc.text(nameLines, tx, y); y += nameLines.length * 7;
    doc.setTextColor(...GOLD); doc.setFontSize(11); doc.text(item.brand_name, tx, y); y += 10;
    const row = (label: string, value?: string | null) => {
      if (!value) return;
      doc.setFont('Inter', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(label.toUpperCase(), tx, y, { charSpace: 0.6 }); y += 4.5;
      doc.setFont('Inter', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(value, tw).slice(0, 4); doc.text(lines, tx, y); y += lines.length * 4.2 + 3;
    };
    row('Dimensions', item.dimensions); row('Materials', item.materials); row('Lead time', item.lead_time);
    row('Price', 'Price upon Request');
    if (item.public_url) {
      doc.setFont('Inter', 'normal'); doc.setFontSize(8); doc.setTextColor(...JADE);
      doc.textWithLink('View piece online', tx, Math.min(y + 2, top + slotH - 6), { url: item.public_url });
    }
  });

  // Branded closing page: personal call to action plus concierge contact details.
  const itemPages = doc.getNumberOfPages() - coverPages;
  const contact = shortlistContact(cover);
  doc.addPage();
  const closingPage = () => {
    doc.setFillColor(...JADE); doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.rect(10, 10, W - 20, H - 20);
    doc.setTextColor(...GOLD); doc.setFont('Cormorant', 'normal'); doc.setFontSize(11);
    doc.text('MAISON AFFLUENCY', W / 2, 40, { align: 'center', charSpace: 2 });
  };
  closingPage();
  let closeY = 116;
  const closingText = (text: string, size: number, color: [number, number, number], url?: string) => {
    doc.setFont('Inter', 'normal'); doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, W - 64);
    const lineH = size * 0.3528 * 1.4;
    for (const line of lines) {
      if (closeY + lineH > H - 28) { doc.addPage(); closingPage(); closeY = 70; }
      doc.setFont('Inter', 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
      if (url) doc.textWithLink(line, W / 2, closeY, { align: 'center', url });
      else doc.text(line, W / 2, closeY, { align: 'center' });
      closeY += lineH;
    }
  };
  doc.setTextColor(245, 245, 245); doc.setFont('Cormorant', 'normal'); doc.setFontSize(22);
  doc.text('A Personal Note', W / 2, closeY, { align: 'center' });
  closeY += 20;
  const closingMessage = cover.closingMessage.trim() || 'Should any of these pieces capture your imagination, our concierge will be delighted to arrange a private viewing, share further details, or discuss them with you at your convenience.';
  closingText(closingMessage, 10.5, [228, 228, 228]);
  closeY += 12;
  if (closeY + 58 > H - 28) { doc.addPage(); closingPage(); closeY = 70; }
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.line(W / 2 - 14, closeY, W / 2 + 14, closeY);
  closeY += 18;
  doc.setFont('Inter', 'normal'); doc.setFontSize(7); doc.setTextColor(...GOLD);
  doc.text('CONCIERGE SERVICE', W / 2, closeY, { align: 'center', charSpace: 1.5 });
  closeY += 10;
  closingText(contact.conciergeEmail, 10, [245, 245, 245], contact.emailUrl);
  closeY += 3;
  closingText(contact.website, 10, [245, 245, 245], contact.websiteUrl);
  closeY += 6;
  closingText(contact.availability, 8.5, [190, 190, 190]);

  const numbered = itemPages; // cover(s) and closing pages stay unnumbered
  for (let p = coverPages + 1; p <= coverPages + numbered; p++) {
    doc.setPage(p); doc.setFont('Inter', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(`${p - coverPages} / ${numbered}`, W - M, H - 8, { align: 'right' });
    doc.text('Curated by Maison Affluency · concierge@maisonaffluency.com', M, H - 8);
  }
  return doc.output('blob');
}
