import { Helmet } from "react-helmet-async";
import { useState } from "react";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Download, CheckCircle2, XCircle } from "lucide-react";
import {
  buildProcurementWorkbook,
  autoPoNumber,
  type ProcurementLine,
  type ExportInput,
} from "@/lib/procurementExcel";

interface Assertion {
  name: string;
  pass: boolean;
  detail: string;
}

const SAMPLE_LINES: ProcurementLine[] = [
  {
    po_number: "PO-CUSTOM-001",
    cost_code: "CC-LIV-100",
    room: "Living Room",
    item_code: "AL-SIDE-01",
    designer: "Alexander Lamont",
    product_name: "Angelo M Side Table",
    finish_or_com: "Bronze · Shagreen",
    quantity: 2,
    unit_rrp_cents: 1200000,   // €12,000
    unit_trade_cents: 1104000, // €11,040 (8% trade)
    currency: "EUR",
    lead_time_weeks: 14,
    deposit_pct: 0.6,
    status: "Confirmed",
    supplier: "Alexander Lamont",
    notes: "Sample QA line A",
  },
  {
    po_number: "", // force auto-generation
    cost_code: "",
    room: "Dining",
    item_code: "MOP-MAD-01",
    designer: "Man of Parts",
    product_name: "Madison Avenue Cocktail Table",
    finish_or_com: "Walnut",
    quantity: 1,
    unit_rrp_cents: 850000,
    unit_trade_cents: 782000,
    currency: "EUR",
    lead_time_weeks: 22, // triggers conditional formatting (>20)
    deposit_pct: 0.5,
    status: "Submitted",
    supplier: "Man of Parts",
    notes: "Sample QA line B",
  },
  {
    po_number: "",
    cost_code: "CC-BED-300",
    room: "Bedroom",
    item_code: "AL-LMP-09",
    designer: "Alexander Lamont",
    product_name: "Lotus Table Lamp",
    finish_or_com: "Parchment",
    quantity: 4,
    unit_rrp_cents: 320000,
    unit_trade_cents: 294400,
    currency: "EUR",
    lead_time_weeks: 10,
    deposit_pct: 0.6,
    status: "Confirmed",
    supplier: "Alexander Lamont",
    notes: "Sample QA line C",
  },
];

function buildSampleInput(): ExportInput {
  // Apply auto PO numbering the same way TradeFFESchedule does
  const seqByQuote: Record<string, number> = {};
  const quoteRef = "QU-TEST01";
  const lines = SAMPLE_LINES.map((l) => {
    seqByQuote[quoteRef] = (seqByQuote[quoteRef] || 0) + 1;
    return {
      ...l,
      po_number: l.po_number || autoPoNumber(quoteRef, seqByQuote[quoteRef]),
    };
  });
  return {
    meta: {
      project_name: "QA — Procurement Export Test",
      client_name: "Internal QA",
      designer_studio: "Maison Affluency",
      address: "—",
      revision: "Rev 1",
      quote_refs: [quoteRef],
    },
    lines,
    fileName: "ffe-export-test.xlsx",
  };
}

function formulaOf(cell: ExcelJS.Cell): string | null {
  const v: any = cell.value;
  if (v && typeof v === "object" && "formula" in v) return String(v.formula);
  return null;
}

async function runAssertions(blob: Blob): Promise<Assertion[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  const out: Assertion[] = [];
  const push = (name: string, pass: boolean, detail = "") => out.push({ name, pass, detail });

  const ffe = wb.getWorksheet("FF&E Schedule");
  push("Sheet 'FF&E Schedule' exists", !!ffe);
  if (!ffe) return out;

  // Header sanity
  const headerRow = ffe.getRow(1);
  const headers = (headerRow.values as any[]).slice(1).map((v) => String(v ?? ""));
  push("Has PO # header", headers[0] === "PO #", `got "${headers[0]}"`);
  push("Has Cost Code header", headers[1] === "Cost Code", `got "${headers[1]}"`);
  push("Has Lead (wks) header", headers[11] === "Lead (wks)", `got "${headers[11]}"`);
  push("Has Deposit % header", headers[13] === "Deposit %", `got "${headers[13]}"`);

  // Row 2 — first sample line (custom PO + cost code)
  const r2 = ffe.getRow(2);
  push("Row 2 PO# preserved", r2.getCell(1).value === "PO-CUSTOM-001", String(r2.getCell(1).value));
  push("Row 2 Cost Code preserved", r2.getCell(2).value === "CC-LIV-100", String(r2.getCell(2).value));
  push("Row 2 Qty = 2", r2.getCell(8).value === 2, String(r2.getCell(8).value));
  push("Row 2 Lead = 14 wks", r2.getCell(12).value === 14, String(r2.getCell(12).value));
  push("Row 2 Deposit % = 0.6", r2.getCell(14).value === 0.6, String(r2.getCell(14).value));

  // Row 3 — auto PO numbering kicked in
  const r3 = ffe.getRow(3);
  push(
    "Row 3 PO# auto-generated as QU-TEST01-002",
    r3.getCell(1).value === "QU-TEST01-002",
    String(r3.getCell(1).value),
  );

  // Live formulas on row 2: K=ext, M=eta, O=depDue, P=balance
  const extF = formulaOf(r2.getCell(11));
  const etaF = formulaOf(r2.getCell(13));
  const depF = formulaOf(r2.getCell(15));
  const balF = formulaOf(r2.getCell(16));
  push("Row 2 Ext Trade is live formula H*J", !!extF && extF.includes("H2*J2"), extF || "(no formula)");
  push("Row 2 ETA is live formula TODAY()+L*7", !!etaF && etaF.includes("TODAY()") && etaF.includes("L2*7"), etaF || "(no formula)");
  push("Row 2 Deposit Due is live formula K*N", !!depF && depF.includes("K2*N2"), depF || "(no formula)");
  push("Row 2 Balance is live formula K-O", !!balF && balF.includes("K2-O2"), balF || "(no formula)");

  // Totals row formulas
  const totalRow = SAMPLE_LINES.length + 3; // header + N lines + 1 blank + total
  const sumExt = formulaOf(ffe.getCell(`K${totalRow}`));
  const sumDep = formulaOf(ffe.getCell(`O${totalRow}`));
  const sumBal = formulaOf(ffe.getCell(`P${totalRow}`));
  push("Totals K = SUM(K2:K…)", !!sumExt && sumExt.startsWith("SUM(K2:K"), sumExt || "(no formula)");
  push("Totals O = SUM(O2:O…)", !!sumDep && sumDep.startsWith("SUM(O2:O"), sumDep || "(no formula)");
  push("Totals P = SUM(P2:P…)", !!sumBal && sumBal.startsWith("SUM(P2:P"), sumBal || "(no formula)");

  // Deposit Schedule — supplier rollups (SUMIF)
  const dep = wb.getWorksheet("Deposit Schedule");
  push("Sheet 'Deposit Schedule' exists", !!dep);
  if (dep) {
    const subF = formulaOf(dep.getCell("C2"));
    push(
      "Supplier subtotal uses SUMIF on FF&E Schedule",
      !!subF && subF.includes("SUMIF") && subF.includes("'FF&E Schedule'"),
      subF || "(no formula)",
    );
  }

  // Lead Time Summary — MINIFS / MAXIFS / AVERAGEIF
  const lt = wb.getWorksheet("Lead Time Summary");
  push("Sheet 'Lead Time Summary' exists", !!lt);
  if (lt) {
    const minF = formulaOf(lt.getCell("B2"));
    const maxF = formulaOf(lt.getCell("C2"));
    const avgF = formulaOf(lt.getCell("D2"));
    push("Lead Min uses MINIFS", !!minF && minF.includes("MINIFS"), minF || "(no formula)");
    push("Lead Max uses MAXIFS", !!maxF && maxF.includes("MAXIFS"), maxF || "(no formula)");
    push("Lead Avg uses AVERAGEIF", !!avgF && avgF.includes("AVERAGEIF"), avgF || "(no formula)");
  }

  // Project Info
  const info = wb.getWorksheet("Project Info");
  push("Sheet 'Project Info' exists", !!info);

  return out;
}

export default function TradeFFEExportTest() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Assertion[] | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const input = buildSampleInput();
      const blob = await buildProcurementWorkbook(input);
      setLastBlob(blob);
      const asserts = await runAssertions(blob);
      setResults(asserts);
    } catch (e: any) {
      setError(e?.message || "Test run failed");
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    if (!lastBlob) return;
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ffe-export-test.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const passCount = results?.filter((r) => r.pass).length ?? 0;
  const total = results?.length ?? 0;
  const allPass = results && passCount === total;

  return (
    <>
      <Helmet><title>FF&E Export — QA Test</title></Helmet>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">FF&E Export — QA Test</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Builds a sample procurement workbook in-memory and verifies PO #, Cost Code, Lead weeks,
            Deposit % and live formulas (Ext Trade, ETA, Deposit Due, Balance, SUM totals,
            supplier SUMIF / MINIFS / MAXIFS) are exported correctly.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={run} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run test
          </Button>
          <Button onClick={download} disabled={!lastBlob} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download sample .xlsx
          </Button>
        </div>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 rounded-md p-3 font-body text-sm text-destructive">
            {error}
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <div
              className={`rounded-md border px-4 py-3 font-body text-sm ${
                allPass
                  ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
                  : "border-amber-600/40 bg-amber-600/10 text-amber-700"
              }`}
            >
              {passCount} / {total} assertions passed
              {allPass ? " — ✅ procurement export is healthy." : " — ⚠️ failures below."}
            </div>

            <ul className="border border-border rounded-md divide-y divide-border">
              {results.map((r, i) => (
                <li key={i} className="px-4 py-2 flex items-start gap-3">
                  {r.pass ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-body text-sm text-foreground">{r.name}</div>
                    {r.detail && (
                      <div className="font-body text-[11px] text-muted-foreground truncate">
                        {r.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
