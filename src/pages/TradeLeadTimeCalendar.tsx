import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CalendarDays } from "lucide-react";
import { format, addWeeks, addDays, eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isSameMonth } from "date-fns";

const PHASE_COLORS: Record<string, string> = {
  production: "bg-blue-200 border-blue-400",
  shipping: "bg-amber-200 border-amber-400",
  customs: "bg-purple-200 border-purple-400",
  balance_due: "bg-red-200 border-red-400",
};

export default function TradeLeadTimeCalendar() {
  const { user, isAdmin } = useAuth();

  const { data: timelines = [], isLoading } = useQuery({
    queryKey: ["lead-time-cal", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from("order_timeline").select("*, trade_quotes(client_name)");
      if (!isAdmin) query = query.eq("user_id", user!.id);
      const { data } = await query.order("deposit_paid_at", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  // Build date ranges for each timeline
  const ranges = timelines.map((tl: any) => {
    const start = new Date(tl.deposit_paid_at || tl.created_at);
    const prodEnd = addWeeks(tl.production_start_at ? new Date(tl.production_start_at) : start, tl.production_weeks);
    const shipEnd = addWeeks(prodEnd, tl.shipping_weeks);
    const custEnd = addDays(shipEnd, tl.customs_days);
    return {
      id: tl.id,
      name: tl.trade_quotes?.client_name || "Order",
      phases: [
        { key: "production", start, end: prodEnd },
        { key: "shipping", start: prodEnd, end: shipEnd },
        { key: "customs", start: shipEnd, end: custEnd },
      ],
      balanceDue: tl.balance_due_at ? new Date(tl.balance_due_at) : addDays(prodEnd, -14),
    };
  });

  // Find total date range
  const allDates = ranges.flatMap((r) => r.phases.flatMap((p) => [p.start, p.end]));
  const minDate = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date();
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : addWeeks(new Date(), 24);

  return (
    <>
      <Helmet><title>Lead Time Calendar — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Lead Time Calendar</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Visual calendar overlay of all active orders showing production, shipping, and delivery milestones.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(PHASE_COLORS).map(([key, cls]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm border ${cls}`} />
              <span className="font-body text-[10px] capitalize text-muted-foreground">{key.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : ranges.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No active orders. Calendar data will appear after orders are placed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <div className="min-w-[800px]">
              {/* Month headers */}
              <div className="flex border-b border-border bg-muted/30">
                <div className="w-40 shrink-0 px-4 py-2 border-r border-border">
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Order</span>
                </div>
                <div className="flex-1 flex">
                  {eachMonthOfInterval({ start: startOfMonth(minDate), end: endOfMonth(maxDate) }).map((month) => {
                    const daysInMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).length;
                    return (
                      <div key={month.toISOString()} className="border-r border-border/50 text-center py-2" style={{ flex: daysInMonth }}>
                        <span className="font-body text-[10px] text-muted-foreground">{format(month, "MMM yyyy")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline rows */}
              {ranges.map((range) => {
                const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={range.id} className="flex border-b border-border/50 hover:bg-muted/10">
                    <div className="w-40 shrink-0 px-4 py-3 border-r border-border">
                      <span className="font-body text-xs text-foreground truncate block">{range.name}</span>
                    </div>
                    <div className="flex-1 relative h-10">
                      {range.phases.map((phase) => {
                        const left = ((phase.start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                        const width = ((phase.end.getTime() - phase.start.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                        return (
                          <div
                            key={phase.key}
                            className={`absolute top-2 h-6 rounded-sm border ${PHASE_COLORS[phase.key] || "bg-muted"}`}
                            style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` }}
                            title={`${phase.key}: ${format(phase.start, "dd MMM")} — ${format(phase.end, "dd MMM")}`}
                          />
                        );
                      })}
                      {/* Balance due marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-destructive"
                        style={{ left: `${((range.balanceDue.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100}%` }}
                        title={`Balance due: ${format(range.balanceDue, "dd MMM yyyy")}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
