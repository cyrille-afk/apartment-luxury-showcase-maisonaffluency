import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ShippingEstimatorForm from "@/components/trade/shipping/ShippingEstimatorForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/shippingEstimator";
import { Truck, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function TradeShippingEstimator() {
  const { isAdmin, isTradeUser, loading } = useAuth();

  const { data: recent = [] } = useQuery({
    queryKey: ["my-shipping-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && (isAdmin || isTradeUser),
  });

  if (loading) return null;
  if (!isAdmin && !isTradeUser) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Shipping Estimator — Trade Portal — Maison Affluency</title></Helmet>

      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl text-foreground">Shipping estimator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1 max-w-2xl">
            Get an indicative all-in landed-cost estimate covering freight, fuel, insurance, customs, duties, and last-mile delivery. Estimates lock to a confirmed rate the day balance of payment is settled.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <ShippingEstimatorForm />
            </div>
          </div>

          <aside className="lg:col-span-2 space-y-3">
            <h2 className="font-display text-sm text-foreground">Your recent estimates</h2>
            {recent.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground">No estimates yet.</p>
            ) : recent.map(r => (
              <div key={r.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm text-foreground">
                    {r.origin_country} → {r.dest_country}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${r.status === "confirmed" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                    {r.status}
                  </span>
                </div>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  {r.selected_carrier} · {r.total_volume_cbm} cbm
                </p>
                <p className="font-display text-base text-foreground mt-1 tabular-nums">
                  {formatMoney(r.total_cents, r.currency)}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/80 font-body">
                  <Calendar className="h-3 w-3" /> {format(new Date(r.created_at), "dd MMM yyyy")}
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </>
  );
}
