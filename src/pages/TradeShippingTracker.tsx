import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Truck, Package, CheckCircle2, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

const STAGES = [
  { key: "deposit_paid", label: "Order Placed", icon: Package },
  { key: "in_production", label: "In Production", icon: Clock },
  { key: "shipping", label: "Shipping", icon: Truck },
  { key: "customs", label: "Customs", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const stageIndex = (s: string) => STAGES.findIndex((st) => st.key === s);

export default function TradeShippingTracker() {
  const { user } = useAuth();

  const { data: timelines = [], isLoading } = useQuery({
    queryKey: ["shipping-tracker", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_timeline")
        .select("*, trade_quotes(client_name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <>
      <Helmet><title>Shipping Tracker — Trade Portal</title></Helmet>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Shipping & Logistics</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Track delivery progress across all your active orders.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : timelines.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No active orders to track.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {timelines.map((tl: any) => {
              const current = stageIndex(tl.kanban_status);
              const clientName = tl.trade_quotes?.client_name || "Order";
              return (
                <div key={tl.id} className="border border-border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-sm text-foreground">{clientName}</h3>
                    {tl.estimated_delivery_at && (
                      <span className="font-body text-[10px] text-muted-foreground">
                        Est. delivery: {format(new Date(tl.estimated_delivery_at), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0">
                    {STAGES.map((stage, i) => {
                      const completed = i <= current;
                      const Icon = stage.icon;
                      return (
                        <div key={stage.key} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${completed ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={`font-body text-[9px] mt-1.5 text-center ${completed ? "text-foreground" : "text-muted-foreground"}`}>
                              {stage.label}
                            </span>
                          </div>
                          {i < STAGES.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 ${i < current ? "bg-foreground" : "bg-border"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
