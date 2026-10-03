/**
 * Shareable PDF export for a Past Curations entry.
 *
 * Renders the curation title, date, project, saved product selections
 * (designer, finish, quantity) and a conversation excerpt into a clean
 * portrait A4 document. Shareable = no pricing, no tier data.
 */

export interface CurationExportPick {
  title: string;
  designer?: string | null;
  finish?: string | null;
  qty?: number | null;
}

export interface CurationExportTurn {
  role: "user" | "assistant";
  text: string;
}

export interface CurationExportData {
  title: string;
  updatedAt: string;
  projectName: string | null;
  picks: CurationExportPick[];
  turns: CurationExportTurn[];
}

const JADE: [number, number, number] = [36, 77, 65]; // --primary 168 45% 30%
const INK: [number, number, number] = [33, 33, 31];
const MUTED: [number, number, number] = [87, 107, 103];
const LINE: [number, number, number] = [214, 210, 204];

export async function renderCurationPdf(data: CurationExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  let y = 0;

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("MAISON AFFLUENCY · TRADE CONCIERGE", M, H - 28);
    doc.text(
      new Date(data.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
      W - M, H - 28, { align: "right" },
    );
  };

  const newPage = () => {
    footer();
    doc.addPage();
    y = M;
  };

  const ensure = (need: number) => {
    if (y + need > H - 56) newPage();
  };

  // ---- Header ----
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...JADE);
  doc.text("MAISON AFFLUENCY", M, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("TRADE CONCIERGE · CURATION", W - M, y, { align: "right" });
  y += 26;

  doc.setFont("times", "italic");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  for (const line of doc.splitTextToSize(data.title || "Untitled curation", CW)) {
    ensure(26);
    doc.text(line, M, y);
    y += 26;
  }
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const meta: string[] = [];
  if (data.projectName) meta.push(`Project — ${data.projectName}`);
  meta.push(`Last updated ${new Date(data.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`);
  doc.text(meta.join("   ·   "), M, y);
  y += 10;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 22;

  // ---- Saved selections ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...JADE);
  doc.text("SAVED SELECTIONS", M, y);
  y += 16;

  if (data.picks.length === 0) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text("No saved products in this curation.", M, y);
    y += 18;
  } else {
    data.picks.forEach((p, i) => {
      const detail = [p.designer, p.finish, p.qty && p.qty > 1 ? `Qty ${p.qty}` : null]
        .filter(Boolean)
        .join("   ·   ");
      const titleLines = doc.splitTextToSize(p.title, CW - 20) as string[];
      const blockH = titleLines.length * 13 + (detail ? 13 : 0) + 10;
      ensure(blockH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(titleLines, M + 20, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(String(i + 1).padStart(2, "0"), M, y);
      y += titleLines.length * 13;

      if (detail) {
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(detail, M + 20, y);
        y += 13;
      }
      y += 4;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.4);
      doc.line(M + 20, y, W - M, y);
      y += 8;
    });
  }

  // ---- Conversation excerpt ----
  if (data.turns.length > 0) {
    ensure(40);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...JADE);
    doc.text("CONVERSATION EXCERPT", M, y);
    y += 16;

    for (const turn of data.turns) {
      const label = turn.role === "user" ? "YOU" : "FELIX";
      const plain = turn.text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[*_`]/g, "");
      const lines = doc.splitTextToSize(plain, CW - 60) as string[];
      const blockH = lines.length * 12 + 14;
      ensure(blockH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...(turn.role === "user" ? INK : JADE));
      doc.text(label, M, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(lines, M + 60, y);
      y += blockH;
    }
  }

  footer();

  const slug = (data.title || "curation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "curation";
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
