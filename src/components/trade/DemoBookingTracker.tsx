/**
 * Demo Booking Tracker — always-visible ledger of every demo booked from the
 * Inbound Lead Response Templates panel. Each row shows the lead, demo date,
 * Trade ID Audit progress, and links straight into the audit checklist.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ClipboardCheck, ArrowRight } from "lucide-react";

type LeadLite = { id: string; studio_name: string };

const AUDIT_TOTAL = 5; // keep in sync with AUDIT_ITEMS in InboundLeadTemplates

const STATUS_LABEL: Record<string, string> = {
  pending: "Audit pending",
  in_review: "Audit in review",
  verified: "Verified",
};

export default function DemoBookingTracker({
  leads,
  onOpenChecklist,
}: {
  leads: LeadLite[];
  onOpenChecklist: () => void;
}) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["acquisition-demo-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_demo_bookings")
        .select("id, lead_id, demo_at, audit_status, trade_id_audit, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const leadName = (id: string) => leads.find((l) => l.id === id)?.studio_name ?? "Unknown lead";

  return (
    <section className="mt-8 border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <span className="flex items-center gap-3">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.25em] text-foreground">Demo Booking Tracker</span>
          <Badge variant="outline" className="text-[10px]">{bookings.length} booked</Badge>
        </span>
        <Button size="sm" variant="outline" onClick={onOpenChecklist}>
          <ClipboardCheck className="mr-2 h-4 w-4" />Open Trade ID Audit Checklist
        </Button>
      </header>

      <div className="border-t border-border">
        {isLoading ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">
            No demos booked yet. Use “Log demo booked” in the response templates panel below to add one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {bookings.map((b) => {
              const audit = (b.trade_id_audit as Record<string, boolean>) ?? {};
              const done = Object.values(audit).filter(Boolean).length;
              return (
                <div key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
                  <div className="min-w-[200px]">
                    <p className="text-sm font-medium text-foreground">{leadName(b.lead_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.demo_at ? new Date(b.demo_at).toLocaleString() : "Demo date TBC"}
                    </p>
                  </div>
                  <Badge
                    variant={b.audit_status === "verified" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {STATUS_LABEL[b.audit_status] ?? b.audit_status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Checklist {done}/{AUDIT_TOTAL}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenChecklist}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Review checklist <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
