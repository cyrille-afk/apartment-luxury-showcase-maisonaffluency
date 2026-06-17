import jsPDF from "jspdf";

export interface FloorPlanLegendItem {
  index: number;
  name: string;
  brand: string;
  dimensions: string;
}

interface ExportOptions {
  canvasDataUrl: string; // composited stage image (plan + items + dimensions)
  canvasWidthPx: number;
  canvasHeightPx: number;
  title: string;
  legend: FloorPlanLegendItem[];
  scaleNote: string; // e.g. "Scale 1 : 50 (approx)"
}

// Compose a landscape A3 PDF with the rendered plan + a legend table.
export async function exportFloorPlanPdf(opts: ExportOptions): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = pdf.internal.pageSize.getWidth(); // 420
  const pageH = pdf.internal.pageSize.getHeight(); // 297
  const margin = 12;

  // Header
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text("MAISON AFFLUENCY  ·  FLOOR PLAN LAYOUT", margin, margin);
  pdf.setFontSize(16);
  pdf.setTextColor(20);
  pdf.text(opts.title || "Untitled layout", margin, margin + 8);
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text(opts.scaleNote, margin, margin + 13);

  // Plan image area: left 70%
  const planAreaW = pageW * 0.66 - margin * 1.5;
  const planAreaH = pageH - margin * 2 - 18;
  const planX = margin;
  const planY = margin + 18;

  const ratio = opts.canvasWidthPx / opts.canvasHeightPx;
  let drawW = planAreaW;
  let drawH = drawW / ratio;
  if (drawH > planAreaH) {
    drawH = planAreaH;
    drawW = drawH * ratio;
  }
  pdf.setDrawColor(220);
  pdf.rect(planX, planY, planAreaW, planAreaH);
  pdf.addImage(opts.canvasDataUrl, "PNG", planX, planY, drawW, drawH, undefined, "FAST");

  // Legend column: right 33%
  const legX = pageW * 0.66 + margin * 0.5;
  const legY = planY;
  const legW = pageW - legX - margin;
  pdf.setFontSize(10);
  pdf.setTextColor(20);
  pdf.text("FF&E Schedule", legX, legY);
  pdf.setDrawColor(20);
  pdf.line(legX, legY + 2, legX + legW, legY + 2);

  pdf.setFontSize(7);
  pdf.setTextColor(60);
  const colNo = legX;
  const colName = legX + 10;
  const colDim = legX + legW - 45;
  pdf.text("#", colNo, legY + 7);
  pdf.text("Item", colName, legY + 7);
  pdf.text("Dimensions", colDim, legY + 7);
  pdf.setDrawColor(220);
  pdf.line(legX, legY + 9, legX + legW, legY + 9);

  pdf.setFontSize(7.5);
  pdf.setTextColor(20);
  let row = legY + 14;
  const rowH = 8;
  for (const item of opts.legend) {
    if (row + rowH > pageH - margin) {
      pdf.addPage();
      row = margin;
    }
    pdf.setTextColor(20);
    pdf.text(String(item.index), colNo, row);
    const nameLines = pdf.splitTextToSize(`${item.name}`, colDim - colName - 4);
    pdf.text(nameLines.slice(0, 2), colName, row);
    pdf.setTextColor(120);
    pdf.setFontSize(6.5);
    pdf.text(item.brand, colName, row + 3);
    pdf.setFontSize(7);
    pdf.setTextColor(20);
    pdf.text(item.dimensions, colDim, row);
    pdf.setDrawColor(235);
    pdf.line(legX, row + 5, legX + legW, row + 5);
    row += rowH;
    pdf.setFontSize(7.5);
  }

  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor(140);
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, pageH - 5);

  return pdf.output("blob");
}
