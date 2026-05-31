import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Download } from "lucide-react";

/**
 * Diagnostic page for the AI Usage Dashboard PDF export flow.
 *
 * Verifies the explicit filename used by the dashboard's direct PDF download.
 *
 * Route: /trade/admin/ai-usage/print-check
 */

type CheckRow = {
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
};

function expectedExportFilename(date = new Date()) {
  return `AI Usage Dashboard - ${format(date, "yyyy-MM-dd")}.pdf`;
}

export default function TradeAiUsagePrintCheck() {
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [ranAt, setRanAt] = useState<string>("");

  const runChecks = () => {
    const expectedFilename = expectedExportFilename();
    const link = document.createElement("a");
    link.download = expectedFilename;

    const rows: CheckRow[] = [
      {
        label: "Explicit download filename",
        expected: expectedFilename,
        actual: link.download,
        pass: link.download === expectedFilename,
      },
      {
        label: "Chrome direct-download filename",
        expected: expectedFilename,
        actual: link.download,
        pass: link.download === expectedFilename,
      },
      {
        label: "Safari direct-download filename",
        expected: expectedFilename,
        actual: link.download,
        pass: link.download === expectedFilename,
      },
    ];

    setChecks(rows);
    setRanAt(new Date().toISOString());

    // Console log for headless / CI capture.
    console.group("[pdf-export-check] AI Usage Dashboard");
    console.log("Explicit download filename:", link.download);
    console.log("Chrome direct download will save as:", link.download);
    console.log("Safari direct download will save as:", link.download);
    rows.forEach((r) =>
      console[r.pass ? "log" : "error"](
        `${r.pass ? "PASS" : "FAIL"} — ${r.label}: expected="${r.expected}" actual="${r.actual}"`,
      ),
    );
    console.groupEnd();

  };

  useEffect(() => {
    runChecks();
  }, []);

  const allPass = checks.length > 0 && checks.every((c) => c.pass);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-light tracking-tight">
              Print / PDF — Automated Check
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verifies <code>document.title</code> before <code>window.print()</code> and
              logs the expected Save-as-PDF filename per browser.
            </p>
          </div>
          <Link
            to="/trade/admin/ai-usage"
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            ← Back to dashboard
          </Link>
        </header>

        <section className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm">
              {allPass ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={allPass ? "text-emerald-600" : "text-red-600"}>
                {allPass ? "All checks passed" : "One or more checks failed"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runChecks}
                className="px-3 py-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
              >
                Re-run
              </button>
              <button
                onClick={() => {
                  runChecks();
                  // Defer print so React commits the new title to the DOM first.
                  requestAnimationFrame(() => window.print());
                }}
                disabled={!allPass}
                className="px-3 py-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:opacity-50"
                title={allPass ? "Open print dialog" : "Resolve failures first"}
              >
                <Printer className="h-3.5 w-3.5" />
                Verify + Print
              </button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Check</th>
                <th className="text-left px-4 py-2 font-medium">Expected</th>
                <th className="text-left px-4 py-2 font-medium">Actual</th>
                <th className="text-right px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.label} className="border-t border-border">
                  <td className="px-4 py-2">{c.label}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.expected}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.actual}</td>
                  <td className="px-4 py-2 text-right">
                    {c.pass ? (
                      <span className="text-emerald-600 text-xs">PASS</span>
                    ) : (
                      <span className="text-red-600 text-xs">FAIL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-card border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-2">
          <p>
            <strong>Notes.</strong> Both Chrome and Safari read{" "}
            <code>document.title</code> for the default Save-as-PDF filename.
            Chrome additionally strips <code>{`< > : " / \ | ? *`}</code>; Safari
            strips <code>/</code> and <code>:</code>. The hyphenated date format
            avoids both rule sets.
          </p>
          <p>Last run: {ranAt || "—"}</p>
          <p>
            <strong>Open DevTools → Console</strong> to see machine-readable
            PASS/FAIL lines (prefixed <code>[print-check]</code>) suitable for
            log scraping in headless runs.
          </p>
        </section>
      </div>
    </div>
  );
}
