/**
 * Purchase Order PDF
 * ------------------
 * A4 portrait, house typography (Times display + Helvetica body), mirroring the
 * in-app PO document sheet. Generated client-side on approval, uploaded to the
 * private `purchase-orders` bucket by `send-purchase-order` and linked in the
 * supplier dispatch email.
 */
import jsPDF from "jspdf";

const FG = [26, 26, 26] as const;
const MUTED = [110, 110, 110] as const;
const RULE = [214, 212, 206] as const;

export interface PurchaseOrderPdfArgs {
  poNumber: string;
  quoteRef: string;
  issuedAt?: Date;
  currency: string;
  supplierName?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  costCode?: string | null;
  requiredBy?: string | null;
  leadTime?: string | null;
  productName: string;
  brandName: string;
  sku?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  quantity: number;
  unitCents?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
}

const money = (cents: number | null | undefined, currency: string) =>
  cents == null
    ? "Price upon Request"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (currency || "EUR").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(cents / 100);

const longDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function buildPurchaseOrderPdf(args: PurchaseOrderPdfArgs): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 54;
  const contentW = pageW - 2 * M;
  const right = pageW - M;
  const issued = args.issuedAt ?? new Date();

  const rule = (y: number) => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.5);
    doc.line(M, y, right, y);
  };

  let y = M + 6;

  /* Masthead -------------------------------------------------------- */
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.text("Maison Affluency", M, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("TRADE PROCUREMENT", M, y + 24, { charSpace: 1.6 });

  doc.text("PURCHASE ORDER", right, y - 2, { align: "right", charSpace: 1.6 });
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text(args.poNumber, right, y + 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Issued ${issued.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    right,
    y + 30,
    { align: "right" },
  );

  y += 44;
  rule(y);
  y += 22;

  /* Meta grid ------------------------------------------------------- */
  const meta: [string, string][] = [
    ["Supplier", args.supplierName || args.brandName || "—"],
    ["Client", args.clientName || "—"],
    ["Project", args.projectName || "—"],
    ["Quote reference", args.quoteRef || "—"],
    ["Cost code", args.costCode || "—"],
    ["Required by", longDate(args.requiredBy)],
    ["Lead time", args.leadTime || "—"],
  ];
  const perRow = 3;
  meta.forEach(([label, value], i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = M + (contentW / perRow) * col;
    const ry = y + row * 38;
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label.toUpperCase(), x, ry, { charSpace: 1.2 });
    doc.setFontSize(9.5);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    const lines = doc.splitTextToSize(value, contentW / perRow - 16) as string[];
    doc.text(lines.slice(0, 2), x, ry + 13);
  });
  y += Math.ceil(meta.length / perRow) * 38 + 8;

  rule(y);
  y += 18;

  /* Line item ------------------------------------------------------- */
  const colQty = right - 210;
  const colUnit = right - 120;
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("DESCRIPTION", M, y, { charSpace: 1.2 });
  doc.text("QTY", colQty, y, { align: "right", charSpace: 1.2 });
  doc.text("UNIT", colUnit, y, { align: "right", charSpace: 1.2 });
  doc.text("TOTAL", right, y, { align: "right", charSpace: 1.2 });
  y += 8;
  rule(y);
  y += 18;

  doc.setFontSize(10.5);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  const titleLines = doc.splitTextToSize(args.productName, colQty - M - 20) as string[];
  titleLines.forEach((t, i) => doc.text(t, M, y + i * 13));
  const detail = [args.brandName, args.sku ? `SKU ${args.sku}` : "", args.dimensions, args.materials]
    .filter(Boolean)
    .join(" · ");
  let blockH = titleLines.length * 13;
  if (detail) {
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const detailLines = doc.splitTextToSize(detail, colQty - M - 20) as string[];
    detailLines.forEach((t, i) => doc.text(t, M, y + blockH + 2 + i * 11));
    blockH += detailLines.length * 11 + 2;
  }

  doc.setFontSize(10.5);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text(String(args.quantity), colQty, y, { align: "right" });
  doc.text(money(args.unitCents, args.currency), colUnit, y, { align: "right" });
  doc.text(
    args.unitCents == null ? "Price upon Request" : money(args.unitCents * args.quantity, args.currency),
    right,
    y,
    { align: "right" },
  );

  y += blockH + 18;
  rule(y);
  y += 18;

  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("ORDER TOTAL", colUnit, y, { align: "right", charSpace: 1.2 });
  doc.setFontSize(12);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text(
    args.unitCents == null ? "Price upon Request" : money(args.unitCents * args.quantity, args.currency),
    right,
    y,
    { align: "right" },
  );

  y += 34;

  /* Terms ----------------------------------------------------------- */
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("TERMS", M, y, { charSpace: 1.2 });
  doc.setFontSize(9);
  const terms =
    "This purchase order is issued against the referenced trade quote. Supplier confirmation of lead time and " +
    "ex-works readiness is required within five business days. Goods must be inspected, protected and labelled " +
    "with the purchase order reference prior to collection. Invoices quoting this reference are settled per the " +
    "agreed trade payment schedule.";
  const termLines = doc.splitTextToSize(terms, contentW) as string[];
  termLines.forEach((t, i) => doc.text(t, M, y + 14 + i * 12));
  y += 20 + termLines.length * 12;

  /* Approval stamp --------------------------------------------------- */
  if (args.approvedByName) {
    y += 10;
    doc.setDrawColor(16, 122, 87);
    doc.setLineWidth(0.8);
    doc.rect(M, y, 220, 48);
    doc.setTextColor(16, 122, 87);
    doc.setFont("times", "normal");
    doc.setFontSize(13);
    doc.text("Approved", M + 14, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(args.approvedByName.toUpperCase(), M + 14, y + 32, { charSpace: 1.1 });
    doc.text(
      args.approvedAt
        ? new Date(args.approvedAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      M + 14,
      y + 42,
    );
    y += 64;
  }

  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Maison Affluency · maisonaffluency.com", pageW / 2, pageH - 28, { align: "center" });

  return doc;
}

/** Base64 (no data-URL prefix) payload for transport to the dispatch function. */
export function purchaseOrderPdfBase64(args: PurchaseOrderPdfArgs): string {
  const doc = buildPurchaseOrderPdf(args);
  return doc.output("datauristring").split(",")[1] ?? "";
}
