import { jsPDF } from "jspdf";
import type { ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";
import { felixLineCents, felixQuantity, felixQuoteTotals } from "@/lib/felixQuoteQuantity";
import { formatPdfDate, formatPdfMoney } from "@/lib/pdfFormatting";

const JADE = [12, 49, 47] as const;
const INK = [40, 40, 40] as const;
const MUTED = [115, 115, 115] as const;
const RULE = [200, 198, 192] as const;

export function felixPdfLines(cards: ProactiveTearsheetData[]) {
  return cards.map((card) => ({ ...card, quantity: felixQuantity(card.quantity), lineTotalCents: felixLineCents(card) }));
}

async function base64File(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("PDF asset unavailable");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([response.arrayBuffer ? new Uint8Array() : ""]));
    response.blob().then((blob) => reader.readAsDataURL(blob), reject);
  });
}

async function photo(url?: string | null): Promise<{ data: string; width: number; height: number } | null> {
  if (!url) return null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
    img.src = url;
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error("Image timeout")), 8000))]);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
  } catch { return null; }
}

export async function buildFelixQuotePdf(cards: ProactiveTearsheetData[], studioName?: string | null, locale?: string | null): Promise<Blob> {
  if (!cards.length) throw new Error("No current quote selections");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const fonts = await Promise.all([base64File("/fonts/pdf/Inter-Light.ttf"), base64File("/fonts/pdf/CormorantGaramond-Regular.ttf")]);
  doc.addFileToVFS("Inter.ttf", fonts[0]); doc.addFont("Inter.ttf", "Inter", "normal");
  doc.addFileToVFS("Cormorant.ttf", fonts[1]); doc.addFont("Cormorant.ttf", "Cormorant", "normal");
  const photos = await Promise.all(cards.map((card) => photo(card.imageUrl)));
  const lines = felixPdfLines(cards);
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 44;
  let y = 156;
  const header = () => {
    doc.setTextColor(...JADE).setFont("Cormorant", "normal").setFontSize(27).text("Maison Affluency", M, 51);
    doc.setFont("Inter", "normal").setFontSize(8).setTextColor(...MUTED).text("FELIX / CURRENT QUOTE", M, 70);
    doc.text(formatPdfDate(new Date(), locale), W - M, 51, { align: "right" });
    doc.setDrawColor(...RULE).line(M, 85, W - M, 85);
    doc.setFont("Cormorant", "normal").setFontSize(23).setTextColor(...JADE).text("Selected pieces", M, 118);
    doc.setFont("Inter", "normal").setFontSize(9).setTextColor(...MUTED).text(doc.splitTextToSize(studioName || "Studio selection", W - M * 2), M, 137);
  };
  const nextPage = () => { doc.addPage(); header(); y = 156; };
  header();
  lines.forEach((line, index) => {
    doc.setFont("Cormorant", "normal").setFontSize(17);
    const name = doc.splitTextToSize(line.productName, W - M * 2 - 118);
    doc.setFont("Inter", "normal").setFontSize(9);
    const meta = [line.brandName, line.fabricLabel && `Fabric: ${line.fabricLabel}`, line.baseLabel && `Base / finish: ${line.baseLabel}`, line.topLabel && `Top / finish: ${line.topLabel}`, line.leadTimeLabel && `Lead time: ${line.leadTimeLabel}`].filter(Boolean).flatMap((value) => doc.splitTextToSize(String(value), W - M * 2 - 118));
    const rowH = Math.max(155, name.length * 20 + meta.length * 13 + 67);
    if (y + rowH > H - 78) nextPage();
    const image = photos[index];
    if (image) {
      const scale = Math.min(92 / image.width, 102 / image.height);
      doc.addImage(image.data, "JPEG", M + (92 - image.width * scale) / 2, y + 3, image.width * scale, image.height * scale);
    }
    const x = M + 112;
    doc.setFont("Cormorant", "normal").setFontSize(17).setTextColor(...INK).text(name, x, y + 16);
    let detailsY = y + 16 + name.length * 20;
    doc.setFont("Inter", "normal").setFontSize(9).setTextColor(...MUTED);
    for (const text of meta) { doc.text(text, x, detailsY); detailsY += 13; }
    const priceY = y + rowH - 30;
    doc.setTextColor(...INK).setFontSize(9);
    const currency = line.priceCurrency || "EUR";
    doc.text(`Quantity: ${line.quantity}`, x, priceY);
    doc.text(`Unit: ${formatPdfMoney(line.unitPriceCents && line.unitPriceCents > 0 ? line.unitPriceCents : null, currency, locale, "Price upon Request")}`, x, priceY + 15);
    doc.text(formatPdfMoney(line.lineTotalCents, currency, locale, "Price upon Request"), W - M, priceY + 15, { align: "right" });
    doc.setDrawColor(...RULE).line(M, y + rowH - 7, W - M, y + rowH - 7);
    y += rowH + 12;
  });
  const totals = felixQuoteTotals(cards);
  if (y + 85 + totals.length * 25 > H - 78) nextPage();
  doc.setFont("Inter", "normal").setFontSize(11).setTextColor(...JADE);
  for (const total of totals) {
    doc.text(total.incomplete ? "Priced subtotal" : "Quote total", M, y + 20);
    doc.text(formatPdfMoney(total.cents, total.currency, locale), W - M, y + 20, { align: "right" }); y += 25;
  }
  doc.setFontSize(8).setTextColor(...MUTED);
  doc.text(doc.splitTextToSize("Current selection estimate. Trade prices are confidential. Shipping, taxes and final availability are subject to confirmation. Unpriced pieces: Price upon Request.", W - M * 2), M, y + 24);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(...RULE).line(M, H - 48, W - M, H - 48);
    doc.setFont("Inter", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text("maisonaffluency.com / trade@maisonaffluency.com", M, H - 31);
    doc.text(`${page} / ${pages}`, W - M, H - 31, { align: "right" });
  }
  return doc.output("blob");
}