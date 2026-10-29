import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";

type Row = { month: string; source: string; currency: string; order_count: number; total_cents: number };

const fmtMoney = (cents: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur || "EUR", minimumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
};
const fmtMonth = (m: string) =>
  new Date(`${m}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function AdminPaidOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeTest, setIncludeTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("admin_paid_orders_monthly", { _months: 12, _include_test: includeTest });
    if (error) setError("Paid orders could not be loaded. Try refreshing.");
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [includeTest]);

  useEffect(() => { void load(); }, [load]);

  const months = useMemo(() => {
    const map = new Map<string, Map<string, { card: number; bank: number; cardCents: number; bankCents: number }>>();
    for (const r of rows) {
      const m = map.get(r.month) ?? new Map();
      const c = m.get(r.currency) ?? { card: 0, bank: 0, cardCents: 0, bankCents: 0 };
      if (r.source === "bank_transfer") { c.bank += Number(r.order_count); c.bankCents += Number(r.total_cents); }
      else { c.card += Number(r.order_count); c.cardCents += Number(r.total_cents); }
      m.set(r.currency, c);
      map.set(r.month, m);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  return (
    <section className="rounded-lg border border-border p-5 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-foreground">Paid orders per month</h2>
          <p className="text-xs text-muted-foreground">Verified payment notices plus bank transfers marked paid · last 12 months</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={includeTest} onCheckedChange={setIncludeTest} aria-label="Include test payments" />
            Include test payments
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!error && !loading && months.length === 0 && (
        <p className="text-sm text-muted-foreground">No paid orders in the last 12 months.</p>
      )}
      {months.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-normal">Month</th>
                <th className="text-left py-2 pr-3 font-normal">Currency</th>
                <th className="text-right py-2 pr-3 font-normal">Online paid</th>
                <th className="text-right py-2 pr-3 font-normal">Bank transfer</th>
                <th className="text-right py-2 pr-3 font-normal">Orders</th>
                <th className="text-right py-2 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.flatMap(([month, curs]) =>
                [...curs.entries()].sort().map(([cur, c], i) => (
                  <tr key={`${month}-${cur}`} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-foreground">{i === 0 ? fmtMonth(month) : ""}</td>
                    <td className="py-2 pr-3">{cur}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.card} · {fmtMoney(c.cardCents, cur)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.bank} · {fmtMoney(c.bankCents, cur)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.card + c.bank}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-foreground">{fmtMoney(c.cardCents + c.bankCents, cur)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
