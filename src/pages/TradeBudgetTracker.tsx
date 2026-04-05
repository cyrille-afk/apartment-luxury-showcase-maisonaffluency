import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Wallet, TrendingUp, TrendingDown } from "lucide-react";

export default function TradeBudgetTracker() {
  const { user } = useAuth();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["budget-tracker", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status, created_at")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded"]);

      if (!data?.length) return [];

      const quoteIds = data.map((q) => q.id);
      const { data: items } = await supabase
        .from("trade_quote_items")
        .select("quote_id, quantity, unit_price_cents")
        .in("quote_id", quoteIds);

      return data.map((q) => {
        const qItems = (items || []).filter((i) => i.quote_id === q.id);
        const total = qItems.reduce((s, i) => s + (i.unit_price_cents || 0) * i.quantity, 0);
        const itemCount = qItems.reduce((s, i) => s + i.quantity, 0);
        return { ...q, total, itemCount };
      });
    },
    enabled: !!user,
  });

  const totalBudget = quotes.reduce((s, q: any) => s + q.total, 0);
  const confirmedTotal = quotes.filter((q: any) => q.status === "confirmed").reduce((s, q: any) => s + q.total, 0);
  const pendingTotal = totalBudget - confirmedTotal;

  return (
    <>
      <Helmet><title>Budget Tracker — Trade Portal</title></Helmet>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Budget Tracker</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Per-project budget vs. actual spend across your confirmed quotes.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Budget", value: totalBudget, icon: Wallet, color: "text-foreground" },
                { label: "Confirmed", value: confirmedTotal, icon: TrendingUp, color: "text-green-600" },
                { label: "Pending", value: pendingTotal, icon: TrendingDown, color: "text-amber-600" },
              ].map((card) => (
                <div key={card.label} className="border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                    <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</span>
                  </div>
                  <p className={`font-display text-xl ${card.color}`}>
                    {card.value > 0 ? `€${(card.value / 100).toLocaleString("en", { minimumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
              ))}
            </div>

            {quotes.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-body text-sm text-muted-foreground">No quotes yet. Budget data will appear after you submit quotes.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Project", "Status", "Items", "Total"].map((h) => (
                        <th key={h} className="px-4 py-3 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q: any) => (
                      <tr key={q.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-body text-sm text-foreground">{q.client_name || "Untitled"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${q.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-body text-sm text-muted-foreground">{q.itemCount}</td>
                        <td className="px-4 py-3 font-display text-sm text-foreground">{q.total > 0 ? `€${(q.total / 100).toFixed(2)}` : "TBD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
