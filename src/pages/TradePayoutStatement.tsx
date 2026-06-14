import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, ArrowLeft } from "lucide-react";

const currentYear = new Date().getUTCFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const TradePayoutStatement = () => {
  const { user, loading } = useAuth();
  const { studios, currentStudioId } = useStudio();
  const { toast } = useToast();
  const [year, setYear] = useState<number>(currentYear - 1);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth?next=/trade/payouts" replace />;

  const studioName = studios.find((s) => s.id === currentStudioId)?.name ?? "your studio";

  const download = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams({ year: String(year) });
      if (currentStudioId) params.set("studio_id", currentStudioId);
      const url = `https://dcrauiygaezoduwdjmsm.functions.supabase.co/tax-payout-export?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `payout-statement-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast({ title: "Statement downloaded" });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Helmet><title>Year-End Payout Statement — Trade</title></Helmet>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link to="/trade/settings" className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to settings
        </Link>

        <div>
          <h1 className="font-display text-2xl text-foreground">Year-End Payout Statement</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Itemised commissions paid to {studioName} during the selected calendar year, with summary totals per currency.
            For your own records and your accountant — this is a reference statement, not a tax form.
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

        <button
          onClick={download}
          disabled={busy}
          className="flex items-center gap-3 text-left px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all disabled:opacity-50 w-full"
        >
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-display text-sm text-foreground">Download CSV statement</div>
            <div className="font-body text-[11px] text-muted-foreground mt-0.5">
              Per-order rows (date issued, delivery date, project, client, currency, amount) plus totals per currency.
            </div>
          </div>
          {busy ? <span className="font-body text-[10px] text-muted-foreground">Building…</span> : <Download className="h-4 w-4 text-muted-foreground" />}
        </button>

        <div className="mt-6 p-4 rounded-lg border border-border bg-muted/20">
          <h2 className="font-display text-sm text-foreground mb-2">Notes</h2>
          <ul className="font-body text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Only orders that have had a commission statement issued in the selected year appear here.</li>
            <li>Net-buy mode orders are excluded — those settle on the white-label invoice, not as a commission payout.</li>
            <li>Maison Affluency operates from Singapore and does not issue US 1099-NEC or Canadian T4A forms. File using your own jurisdiction's rules; this CSV is the source data.</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default TradePayoutStatement;
