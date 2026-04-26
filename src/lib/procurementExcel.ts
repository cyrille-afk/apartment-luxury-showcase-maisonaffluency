/**
 * Procurement-grade Excel (.xlsx) export for FF&E schedules and quotes.
 *
 * Produces a multi-sheet workbook with LIVE formulas:
 *   1. FF&E Schedule  — line-by-line procurement grid
 *   2. Deposit Schedule — totals grouped by supplier (formula-based)
 *   3. Lead Time Summary — min / max / avg weeks per supplier
 *   4. Project Info  — header metadata
 *
 * Procurement managers can edit Qty / Unit / Lead-time / Deposit %
 * cells in Excel and the workbook recalculates.
 */

import ExcelJS from "exceljs";

export interface ProcurementLine {
  /** Persisted PO number (or auto-generated fallback) */
  po_number: string;
  /** Persisted internal cost / budget code (may be empty) */
  cost_code: string;
  room: string;
  item_code: string;          // SKU
  designer: string;           // brand / atelier
  product_name: string;
  finish_or_com: string;      // materials / COM
  quantity: number;
  unit_rrp_cents: number | null;
  unit_trade_cents: number | null;
  currency: string;           // ISO code, e.g. "EUR"
  lead_time_weeks: number | null;
  deposit_pct: number;        // 0..1
  status: string;
  supplier: string;
  notes: string;
}

export interface ProcurementProjectMeta {
  project_name: string;
  client_name: string;
  designer_studio: string;
  address: string;
  revision: string;           // e.g. "Rev 1"
  quote_refs: string[];       // e.g. ["QU-AB12CD"]
}

export interface ExportInput {
  meta: ProcurementProjectMeta;
  lines: ProcurementLine[];
  fileName: string;           // e.g. "ffe-schedule-2026-04-26.xlsx"
}

const CURRENCY_FMT: Record<string, string> = {
  EUR: '"€"#,##0.00;[Red]-"€"#,##0.00',
  USD: '"$"#,##0.00;[Red]-"$"#,##0.00',
  GBP: '"£"#,##0.00;[Red]-"£"#,##0.00',
  SGD: '"S$"#,##0.00;[Red]-"S$"#,##0.00',
};
const fmtForCurrency = (c: string) => CURRENCY_FMT[c] || '#,##0.00';

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F2A24" }, // jade dark
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: "Arial",
  bold: true,
  color: { argb: "FFFAF7F0" },
  size: 10,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD4D4D4" } },
  bottom: { style: "thin", color: { argb: "FFD4D4D4" } },
  left: { style: "thin", color: { argb: "FFD4D4D4" } },
  right: { style: "thin", color: { argb: "FFD4D4D4" } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = BORDER_THIN;
  });
  row.height = 24;
}

export async function buildProcurementWorkbook(input: ExportInput): Promise<Blob> {
  const { meta, lines } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Maison Affluency — Trade Portal";
  wb.created = new Date();

  // Use the first line's currency as the workbook's display currency
  const displayCurrency = lines[0]?.currency || "EUR";
  const moneyFmt = fmtForCurrency(displayCurrency);

  // ───────────────────── Sheet 1 — FF&E Schedule ──────────────────────
  const ffe = wb.addWorksheet("FF&E Schedule", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ffe.columns = [
    { header: "PO #", key: "po", width: 14 },
    { header: "Cost Code", key: "cc", width: 14 },
    { header: "Room", key: "room", width: 14 },
    { header: "Item Code (SKU)", key: "sku", width: 18 },
    { header: "Designer / Atelier", key: "designer", width: 22 },
    { header: "Product", key: "product", width: 32 },
    { header: "Finish / COM", key: "finish", width: 22 },
    { header: "Qty", key: "qty", width: 6 },
    { header: `Unit RRP (${displayCurrency})`, key: "unitRrp", width: 14 },
    { header: `Unit Trade (${displayCurrency})`, key: "unitTrade", width: 14 },
    { header: `Ext. Trade (${displayCurrency})`, key: "extTrade", width: 14 },
    { header: "Lead (wks)", key: "lead", width: 10 },
    { header: "ETA Date", key: "eta", width: 12 },
    { header: "Deposit %", key: "depPct", width: 10 },
    { header: `Deposit Due (${displayCurrency})`, key: "depDue", width: 14 },
    { header: `Balance (${displayCurrency})`, key: "balance", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Supplier", key: "supplier", width: 22 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  styleHeader(ffe.getRow(1));

  lines.forEach((l, i) => {
    const r = i + 2; // Excel row (header is row 1)
    ffe.addRow({
      po: l.po_number,
      cc: l.cost_code,
      room: l.room,
      sku: l.item_code,
      designer: l.designer,
      product: l.product_name,
      finish: l.finish_or_com,
      qty: l.quantity,
      unitRrp: l.unit_rrp_cents != null ? l.unit_rrp_cents / 100 : null,
      unitTrade: l.unit_trade_cents != null ? l.unit_trade_cents / 100 : null,
      // Live formulas — qty × unit-trade
      extTrade: { formula: `IF(AND(ISNUMBER(H${r}),ISNUMBER(J${r})),H${r}*J${r},"")` } as any,
      lead: l.lead_time_weeks,
      // ETA = TODAY() + (lead × 7) when lead is numeric
      eta: { formula: `IF(ISNUMBER(L${r}),TODAY()+L${r}*7,"")` } as any,
      depPct: l.deposit_pct,
      // Deposit Due = ext × deposit %
      depDue: { formula: `IF(AND(ISNUMBER(K${r}),ISNUMBER(N${r})),K${r}*N${r},"")` } as any,
      // Balance = ext − deposit
      balance: { formula: `IF(AND(ISNUMBER(K${r}),ISNUMBER(O${r})),K${r}-O${r},"")` } as any,
      status: l.status,
      supplier: l.supplier,
      notes: l.notes,
    });
  });

  // Number formats
  const lastRow = lines.length + 1;
  ["I", "J", "K", "O", "P"].forEach((col) => {
    ffe.getColumn(col).numFmt = moneyFmt;
  });
  ffe.getColumn("H").numFmt = "0";
  ffe.getColumn("L").numFmt = "0";
  ffe.getColumn("M").numFmt = "dd-mmm-yyyy";
  ffe.getColumn("N").numFmt = "0%";

  // Body borders + zebra
  for (let r = 2; r <= lastRow; r++) {
    const row = ffe.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_THIN;
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "top", wrapText: true };
    });
    if (r % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F6F1" },
        };
      });
    }
  }

  // Status dropdown (column Q, rows 2..lastRow)
  if (lastRow >= 2) {
    for (let r = 2; r <= lastRow; r++) {
      ffe.getCell(`Q${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Draft,Submitted,Confirmed,Ordered,In Production,Shipped,Delivered,Installed"'],
      };
    }
  }

  // Totals row
  const totalRow = lastRow + 2;
  ffe.getCell(`J${totalRow}`).value = "TOTAL";
  ffe.getCell(`J${totalRow}`).font = { bold: true, name: "Arial", size: 10 };
  ffe.getCell(`J${totalRow}`).alignment = { horizontal: "right" };
  if (lastRow >= 2) {
    ffe.getCell(`K${totalRow}`).value = { formula: `SUM(K2:K${lastRow})` } as any;
    ffe.getCell(`O${totalRow}`).value = { formula: `SUM(O2:O${lastRow})` } as any;
    ffe.getCell(`P${totalRow}`).value = { formula: `SUM(P2:P${lastRow})` } as any;
  }
  ["K", "O", "P"].forEach((c) => {
    const cell = ffe.getCell(`${c}${totalRow}`);
    cell.numFmt = moneyFmt;
    cell.font = { bold: true, name: "Arial", size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E2D5" },
    };
    cell.border = BORDER_THIN;
  });

  // Conditional formatting — overdue lead times (>20 weeks) in red
  if (lastRow >= 2) {
    ffe.addConditionalFormatting({
      ref: `L2:L${lastRow}`,
      rules: [
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: ["20"],
          priority: 1,
          style: {
            font: { color: { argb: "FFB91C1C" }, bold: true, name: "Arial", size: 10 },
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } },
          },
        },
      ],
    });
  }

  // ───────────────────── Sheet 2 — Deposit Schedule ───────────────────
  const dep = wb.addWorksheet("Deposit Schedule");
  dep.columns = [
    { header: "Supplier", key: "supplier", width: 26 },
    { header: "Lines", key: "lines", width: 8 },
    { header: `Subtotal Trade (${displayCurrency})`, key: "sub", width: 18 },
    { header: `Deposit Due (${displayCurrency})`, key: "dep", width: 18 },
    { header: `Balance (${displayCurrency})`, key: "bal", width: 18 },
  ];
  styleHeader(dep.getRow(1));

  const suppliers = Array.from(new Set(lines.map((l) => l.supplier).filter(Boolean)));
  suppliers.forEach((sup, i) => {
    const r = i + 2;
    const safe = sup.replace(/"/g, '""');
    dep.addRow({
      supplier: sup,
      lines: { formula: `COUNTIF('FF&E Schedule'!R:R,"${safe}")` } as any,
      sub: { formula: `SUMIF('FF&E Schedule'!R:R,"${safe}",'FF&E Schedule'!K:K)` } as any,
      dep: { formula: `SUMIF('FF&E Schedule'!R:R,"${safe}",'FF&E Schedule'!O:O)` } as any,
      bal: { formula: `SUMIF('FF&E Schedule'!R:R,"${safe}",'FF&E Schedule'!P:P)` } as any,
    });
    const row = dep.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_THIN;
      cell.font = { name: "Arial", size: 10 };
    });
  });
  ["C", "D", "E"].forEach((c) => (dep.getColumn(c).numFmt = moneyFmt));

  if (suppliers.length > 0) {
    const supplierTotalRow = suppliers.length + 3;
    dep.getCell(`B${supplierTotalRow}`).value = "TOTAL";
    dep.getCell(`B${supplierTotalRow}`).font = { bold: true, name: "Arial", size: 10 };
    dep.getCell(`B${supplierTotalRow}`).alignment = { horizontal: "right" };
    ["C", "D", "E"].forEach((c) => {
      const cell = dep.getCell(`${c}${supplierTotalRow}`);
      cell.value = { formula: `SUM(${c}2:${c}${suppliers.length + 1})` } as any;
      cell.numFmt = moneyFmt;
      cell.font = { bold: true, name: "Arial", size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8E2D5" },
      };
      cell.border = BORDER_THIN;
    });
  }

  // ───────────────────── Sheet 3 — Lead Time Summary ──────────────────
  const lt = wb.addWorksheet("Lead Time Summary");
  lt.columns = [
    { header: "Supplier", key: "supplier", width: 26 },
    { header: "Min (wks)", key: "min", width: 12 },
    { header: "Max (wks)", key: "max", width: 12 },
    { header: "Avg (wks)", key: "avg", width: 12 },
    { header: "Earliest ETA", key: "etaMin", width: 14 },
    { header: "Latest ETA", key: "etaMax", width: 14 },
  ];
  styleHeader(lt.getRow(1));

  suppliers.forEach((sup, i) => {
    const r = i + 2;
    const safe = sup.replace(/"/g, '""');
    lt.addRow({
      supplier: sup,
      min: {
        formula: `IFERROR(MINIFS('FF&E Schedule'!L:L,'FF&E Schedule'!R:R,"${safe}"),"")`,
      } as any,
      max: {
        formula: `IFERROR(MAXIFS('FF&E Schedule'!L:L,'FF&E Schedule'!R:R,"${safe}"),"")`,
      } as any,
      avg: {
        formula: `IFERROR(AVERAGEIF('FF&E Schedule'!R:R,"${safe}",'FF&E Schedule'!L:L),"")`,
      } as any,
      etaMin: {
        formula: `IF(ISNUMBER(B${r}),TODAY()+B${r}*7,"")`,
      } as any,
      etaMax: {
        formula: `IF(ISNUMBER(C${r}),TODAY()+C${r}*7,"")`,
      } as any,
    });
    const row = lt.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_THIN;
      cell.font = { name: "Arial", size: 10 };
    });
  });
  lt.getColumn("D").numFmt = "0.0";
  lt.getColumn("E").numFmt = "dd-mmm-yyyy";
  lt.getColumn("F").numFmt = "dd-mmm-yyyy";

  // ───────────────────── Sheet 4 — Project Info ───────────────────────
  const info = wb.addWorksheet("Project Info");
  info.columns = [
    { header: "Field", key: "k", width: 22 },
    { header: "Value", key: "v", width: 60 },
  ];
  styleHeader(info.getRow(1));

  const kv: [string, string][] = [
    ["Project", meta.project_name],
    ["Client", meta.client_name],
    ["Studio / Designer", meta.designer_studio],
    ["Address", meta.address],
    ["Revision", meta.revision],
    ["Quote References", meta.quote_refs.join(", ")],
    ["Display Currency", displayCurrency],
    ["Generated", new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })],
    ["Source", "Maison Affluency — Trade Portal"],
  ];
  kv.forEach(([k, v]) => {
    const row = info.addRow({ k, v });
    row.getCell(1).font = { bold: true, name: "Arial", size: 10 };
    row.getCell(2).font = { name: "Arial", size: 10 };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function downloadProcurementWorkbook(input: ExportInput): Promise<void> {
  const blob = await buildProcurementWorkbook(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = input.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Auto-generate a PO number when the line has no persisted po_number. */
export function autoPoNumber(quoteRef: string, seq: number): string {
  return `${quoteRef}-${String(seq).padStart(3, "0")}`;
}
