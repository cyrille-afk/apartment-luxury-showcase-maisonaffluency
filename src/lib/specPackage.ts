/**
 * Spec Package generator — bundles spec PDFs + an auto-generated cover sheet
 * (dimensions, weight, electrical, COM yardage, fire ratings, install notes)
 * for selected products into one .zip ready to send to a GC/contractor.
 *
 * Runs entirely client-side: jsPDF for the cover sheet, JSZip for the archive,
 * fetch() for downloading existing spec PDFs.
 */
import jsPDF from "jspdf";
import JSZip from "jszip";

export type SpecPackageProduct = {
  product_name: string;
  brand_name?: string | null;
  category?: string | null;
  sku?: string | null;
  dimensions?: string | null;
  weight?: string | null;
  materials?: string | null;
  electrical?: string | null;
  fire_rating?: string | null;
  com_yardage?: string | null;
  installation_notes?: string | null;
  lead_time?: string | null;
  pdf_urls?: string[] | null;
  pdf_url?: string | null;
  image_url?: string | null;
};

export type SpecPackageOptions = {
  projectName?: string;
  studioName?: string;
  contactEmail?: string;
  notes?: string;
};

const slugify = (s: string) =>
  (s || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

/** Generate a single product cover sheet as a PDF blob. */
function buildCoverSheet(p: SpecPackageProduct, opts: SpecPackageOptions): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Header band
  doc.setFillColor(20, 30, 28);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(245, 240, 225);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SPECIFICATION COVER SHEET", margin, 30);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.studioName || "Maison Affluency", margin, 52);

  if (opts.projectName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Project: ${opts.projectName}`, pageW - margin, 30, { align: "right" });
  }
  if (opts.contactEmail) {
    doc.setFontSize(8);
    doc.text(opts.contactEmail, pageW - margin, 52, { align: "right" });
  }

  y = 110;
  doc.setTextColor(20, 20, 20);

  // Product title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(p.product_name, pageW - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22;

  if (p.brand_name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(110, 110, 110);
    doc.text(p.brand_name, margin, y);
    y += 18;
  }

  // Divider
  y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  // Spec rows
  const rows: Array<[string, string | null | undefined]> = [
    ["SKU", p.sku],
    ["Category", p.category],
    ["Dimensions", p.dimensions],
    ["Weight", p.weight],
    ["Materials & Finish", p.materials],
    ["Electrical", p.electrical],
    ["Fire Rating", p.fire_rating],
    ["COM Yardage", p.com_yardage],
    ["Installation Notes", p.installation_notes],
    ["Lead Time", p.lead_time],
  ];

  doc.setTextColor(20, 20, 20);
  for (const [label, value] of rows) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(label.toUpperCase(), margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const valueLines = doc.splitTextToSize(String(value), pageW - margin * 2 - 140);
    doc.text(valueLines, margin + 140, y);

    y += Math.max(18, valueLines.length * 14) + 6;
    if (y > 760) {
      doc.addPage();
      y = margin;
    }
  }

  // Notes
  if (opts.notes) {
    y += 12;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("PROJECT NOTES", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const notesLines = doc.splitTextToSize(opts.notes, pageW - margin * 2);
    doc.text(notesLines, margin, y);
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Generated ${new Date().toLocaleDateString()} — Maison Affluency Trade Portal`,
    margin,
    820,
  );

  return doc.output("blob");
}

async function fetchPdf(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Build and trigger download of a .zip containing one folder per product
 * with the auto-generated cover PDF + any attached spec PDFs.
 */
export async function generateSpecPackageZip(
  products: SpecPackageProduct[],
  opts: SpecPackageOptions = {},
): Promise<{ blob: Blob; filename: string; missingPdfs: string[] }> {
  const zip = new JSZip();
  const missingPdfs: string[] = [];

  // Project README at root
  const readme = [
    `Specification Package`,
    `Generated ${new Date().toLocaleString()}`,
    opts.projectName ? `Project: ${opts.projectName}` : "",
    opts.studioName ? `Studio: ${opts.studioName}` : "",
    opts.contactEmail ? `Contact: ${opts.contactEmail}` : "",
    "",
    `Items: ${products.length}`,
    "",
    "Each folder contains a structured cover sheet (00-cover-sheet.pdf)",
    "and any attached manufacturer specification documents.",
  ]
    .filter(Boolean)
    .join("\n");
  zip.file("README.txt", readme);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const folderName = `${String(i + 1).padStart(2, "0")}-${slugify(
      `${p.brand_name || ""} ${p.product_name}`,
    )}`;
    const folder = zip.folder(folderName)!;

    // Cover sheet
    folder.file("00-cover-sheet.pdf", buildCoverSheet(p, opts));

    // Attached PDFs
    const pdfList = [
      ...(p.pdf_urls || []).filter(Boolean),
      ...(p.pdf_url ? [p.pdf_url] : []),
    ];
    let pdfIdx = 1;
    for (const url of pdfList) {
      const buf = await fetchPdf(url);
      if (!buf) {
        missingPdfs.push(`${p.product_name} — ${url}`);
        continue;
      }
      const cleanName = url.split("/").pop()?.split("?")[0] || `spec-${pdfIdx}.pdf`;
      folder.file(`${String(pdfIdx).padStart(2, "0")}-${cleanName}`, buf);
      pdfIdx++;
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  const projSlug = opts.projectName ? slugify(opts.projectName) : "spec-package";
  const filename = `${projSlug}-${stamp}.zip`;

  return { blob, filename, missingPdfs };
}

/** Trigger a browser download for a generated blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
