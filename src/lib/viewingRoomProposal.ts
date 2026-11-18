import type { ViewingRoomChoice } from "./viewingRoom";
import { formatPdfMoney, formatPdfDate } from "./pdfFormatting";

export async function downloadViewingRoomProposal(snapshot: { package: string; currency: string; total: number; items: ViewingRoomChoice[] }, residence: string, developer: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("times", "normal"); pdf.setFontSize(28); pdf.text(developer, 20, 35);
  pdf.setFontSize(20); pdf.text(residence, 20, 55); pdf.text(`${snapshot.package} Collection`, 20, 72);
  pdf.setFontSize(12); pdf.text(`Locked Package Total: ${formatPdfMoney(Math.round(snapshot.total * 100), snapshot.currency)}`, 20, 100);
  pdf.text(`Proposal requested · ${formatPdfDate(new Date())}`, 20, 112);
  pdf.text("Maison Affluency", 20, 265);
  for (const item of snapshot.items) {
    pdf.addPage(); pdf.setFontSize(20); pdf.text(pdf.splitTextToSize(item.product_name, 170), 20, 30);
    if (item.image_url) { try { const image = await loadImage(item.image_url); pdf.addImage(image, "JPEG", 20, 48, 100, 90); } catch { /* Specifications remain available if media cannot load. */ } }
    pdf.setFontSize(11); pdf.text(pdf.splitTextToSize(item.dimensions ?? "Dimensions to be confirmed", 170), 20, 152);
    let y = 173;
    for (const finish of Object.values(item.materials)) {
      if (finish.image_url) { try { pdf.addImage(await loadImage(finish.image_url), "JPEG", 20, y, 14, 14); } catch { /* Keep recorded finish names. */ } }
      pdf.text(pdf.splitTextToSize(finish.name, 145), 38, y + 7); y += 24;
    }
    pdf.text(`Lead time: ${item.lead_time ?? "To be confirmed"}`, 20, Math.min(y + 10, 260));
    pdf.text("Maison Affluency · Private Client Proposal", 20, 280);
  }
  pdf.save("Private-Viewing-Room-Proposal.pdf");
}
async function loadImage(url: string): Promise<string> {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Image timed out")), 15000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error("Image unavailable")); }; image.src = url; });
  const canvas = document.createElement("canvas"); const ratio = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio);
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image unavailable");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", .9);
}