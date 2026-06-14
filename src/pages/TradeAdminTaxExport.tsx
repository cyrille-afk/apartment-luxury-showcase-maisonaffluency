import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download } from "lucide-react";

const currentYear = new Date().getUTCFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const TradeAdminTaxExport = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [year, setYear] = useState<number>(currentYear - 1);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const download = async (form: "all" | "1099" | "t4a") => {
    setBusy(form);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const url = `https://dcrauiygaezoduwdjmsm.functions.supabase.co/tax-payout-export?year=${year}&form=${form}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `tax-payout-export-${year}${form !== "all" ? "-" + form : ""}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast({ title: "Export downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Helmet><title>1099 / T4A Year-End Export — Admin</title></Helmet>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">1099 / T4A Year-End Export</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Aggregates issued commission payouts per studio for the selected tax year, joined with each studio's default payout account
            (country, tax form, reference). Source: <code>order_timeline.commission_statement_sent_at</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="font-body text-xs uppercase tracking-[0.1em] text-muted-foreground">Tax year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-md border border-border bg-background font-body text-sm"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="grid gap-3">
          {[
            { form: "all" as const, label: "All payouts (full audit CSV)", desc: "Every studio with payouts in this year, all currencies, with form-required flag and threshold note." },
            { form: "1099" as const, label: "1099-NEC (US studios, USD)", desc: "Filtered to US-country payout accounts paid in USD. IRS threshold note: ≥ $600." },
            { form: "t4a" as const, label: "T4A (Canadian studios, CAD)", desc: "Filtered to CA-country payout accounts paid in CAD. CRA threshold note: ≥ $500." },
          ].map(({ form, label, desc }) => (
            <button
              key={form}
              onClick={() => download(form)}
              disabled={busy !== null}
              className="flex items-start gap-3 text-left px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-display text-sm text-foreground">{label}</div>
                <div className="font-body text-[11px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
              {busy === form
                ? <span className="font-body text-[10px] text-muted-foreground">Building…</span>
                : <Download className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-lg border border-border bg-muted/20">
          <h2 className="font-display text-sm text-foreground mb-2">Notes</h2>
          <ul className="font-body text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Studios appear once per (studio, payout currency).</li>
            <li>Threshold notes are advisory — confirm current IRS / CRA rules with your accountant before filing.</li>
            <li>For net-buy mode orders, no commission payout is recorded; only agent-commission orders appear here.</li>
            <li>Studios without a default payout account on file will show blank country / tax form fields — chase those before filing.</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default TradeAdminTaxExport;
