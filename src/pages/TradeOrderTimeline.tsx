import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { format, addWeeks, addDays } from "date-fns";
import {
  DollarSign, Factory, CreditCard, Truck, ShieldCheck, PackageCheck,
  ChevronRight, Calendar, Clock, GripVertical, Edit2, Check, X,
  FolderKanban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import BackToProjectPill from "@/components/trade/BackToProjectPill";

interface OrderTimeline {
  id: string;
  quote_id: string;
  user_id: string;
  kanban_status: string;
  deposit_paid_at: string | null;
  production_start_at: string | null;
  production_end_at: string | null;
  balance_due_at: string | null;
  balance_paid_at: string | null;
  shipping_start_at: string | null;
  shipping_end_at: string | null;
  customs_start_at: string | null;
  customs_cleared_at: string | null;
  estimated_delivery_at: string | null;
  actual_delivery_at: string | null;
  production_weeks: number;
  shipping_weeks: number;
  customs_days: number;
  admin_notes: string | null;
  created_at: string;
  // joined
  client_name?: string | null;
  quote_status?: string;
  currency?: string;
  profile_first_name?: string;
  profile_last_name?: string;
  profile_company?: string;
}

const KANBAN_COLUMNS = [
  { key: "deposit_paid", label: "Deposit Paid", icon: DollarSign, color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  { key: "in_production", label: "In Production", icon: Factory, color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  { key: "balance_due", label: "Balance Due", icon: CreditCard, color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  { key: "shipping", label: "Shipping", icon: Truck, color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  { key: "customs", label: "Customs", icon: ShieldCheck, color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  { key: "delivered", label: "Delivered", icon: PackageCheck, color: "bg-green-500/10 text-green-700 border-green-500/20" },
] as const;

function formatDate(d: string | null) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy");
}

function OrderCard({ order, isAdmin, onMoveNext }: { order: OrderTimeline; isAdmin: boolean; onMoveNext: (order: OrderTimeline) => void }) {
  const currentColIndex = KANBAN_COLUMNS.findIndex(c => c.key === order.kanban_status);
  const nextCol = currentColIndex < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[currentColIndex + 1] : null;

  return (
    <div className="group bg-card border border-border rounded-lg p-3 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-display text-sm text-foreground truncate">
            {order.client_name || "No client"}
          </p>
          <p className="font-body text-[10px] text-muted-foreground truncate">
            {order.profile_first_name} {order.profile_last_name}
            {order.profile_company ? ` · ${order.profile_company}` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0">
          {order.currency || "EUR"}
        </Badge>
      </div>

      {/* Timeline milestones */}
      <div className="space-y-1 mb-2">
        {order.deposit_paid_at && (
          <MilestoneLine icon={DollarSign} label="Deposit" date={order.deposit_paid_at} />
        )}
        {order.production_end_at && (
          <MilestoneLine icon={Factory} label="Production ends" date={order.production_end_at} />
        )}
        {order.balance_due_at && (
          <MilestoneLine icon={CreditCard} label="Balance due" date={order.balance_due_at} highlight={!order.balance_paid_at} />
        )}
        {order.estimated_delivery_at && (
          <MilestoneLine icon={Truck} label="Est. delivery" date={order.estimated_delivery_at} />
        )}
      </div>

      {/* Duration info */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-body">
        <Clock className="h-3 w-3" />
        <span>{order.production_weeks}w prod · {order.shipping_weeks}w ship · {order.customs_days}d customs</span>
      </div>

      {/* Admin: advance to next column */}
      {isAdmin && nextCol && (
        <button
          onClick={() => onMoveNext(order)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-muted hover:bg-muted/80 font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Move to {nextCol.label}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MilestoneLine({ icon: Icon, label, date, highlight }: { icon: React.ElementType; label: string; date: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-body ${highlight ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}:</span>
      <span className="font-medium">{formatDate(date)}</span>
    </div>
  );
}

export default function TradeOrderTimeline() {
  const { isAdmin, isTradeUser, loading, user } = useAuth();
  const queryClient = useQueryClient();
  const { projectFilter, clearProjectFilter } = useProjectFilter();
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (!projectFilter) { setProjectName(null); return; }
    (async () => {
      const { data } = await supabase
        .from("projects" as any)
        .select("name")
        .eq("id", projectFilter)
        .maybeSingle();
      setProjectName((data as any)?.name || null);
    })();
  }, [projectFilter]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["order-timelines", projectFilter],
    queryFn: async () => {
      let q = supabase
        .from("order_timeline")
        .select("*")
        .order("created_at", { ascending: false });
      if (projectFilter) q = q.eq("project_id", projectFilter);
      const { data, error } = await q;
      if (error) throw error;

      // Fetch quote + profile data for each timeline
      if (!data || data.length === 0) return [];

      const quoteIds = data.map((d: any) => d.quote_id);
      const userIds = [...new Set(data.map((d: any) => d.user_id))];

      const [quotesRes, profilesRes] = await Promise.all([
        supabase.from("trade_quotes").select("id, client_name, status, currency").in("id", quoteIds),
        supabase.from("profiles").select("id, first_name, last_name, company").in("id", userIds),
      ]);

      const quotesMap = Object.fromEntries((quotesRes.data || []).map((q: any) => [q.id, q]));
      const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));

      return data.map((d: any) => {
        const q = quotesMap[d.quote_id] || {};
        const p = profilesMap[d.user_id] || {};
        return {
          ...d,
          client_name: q.client_name,
          quote_status: q.status,
          currency: q.currency,
          profile_first_name: p.first_name,
          profile_last_name: p.last_name,
          profile_company: p.company,
        } as OrderTimeline;
      });
    },
    enabled: !loading && (isAdmin || isTradeUser),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, newStatus, updates }: { id: string; newStatus: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("order_timeline")
        .update({ kanban_status: newStatus, ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-timelines"] });
      toast.success("Order moved successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleMoveNext = (order: OrderTimeline) => {
    const currentIdx = KANBAN_COLUMNS.findIndex(c => c.key === order.kanban_status);
    if (currentIdx >= KANBAN_COLUMNS.length - 1) return;
    const nextStatus = KANBAN_COLUMNS[currentIdx + 1].key;
    const now = new Date().toISOString();

    // Auto-fill date fields based on new status
    const updates: Record<string, any> = {};
    if (nextStatus === "in_production") updates.production_start_at = now;
    if (nextStatus === "balance_due") {
      // Calculate balance due = 2 weeks before production end
      const prodEnd = order.production_start_at
        ? addWeeks(new Date(order.production_start_at), order.production_weeks)
        : addWeeks(new Date(), order.production_weeks);
      updates.production_end_at = prodEnd.toISOString();
      updates.balance_due_at = addWeeks(prodEnd, -2).toISOString();
    }
    if (nextStatus === "shipping") {
      updates.balance_paid_at = now;
      updates.shipping_start_at = now;
      const shippingEnd = addWeeks(new Date(), order.shipping_weeks);
      updates.shipping_end_at = shippingEnd.toISOString();
    }
    if (nextStatus === "customs") {
      updates.shipping_end_at = now;
      updates.customs_start_at = now;
      updates.customs_cleared_at = addDays(new Date(), order.customs_days).toISOString();
    }
    if (nextStatus === "delivered") {
      updates.customs_cleared_at = now;
      updates.actual_delivery_at = now;
    }

    moveMutation.mutate({ id: order.id, newStatus: nextStatus, updates });
  };

  if (loading) return null;
  if (!isAdmin && !isTradeUser) return <Navigate to="/trade" replace />;

  const grouped = KANBAN_COLUMNS.map(col => ({
    ...col,
    orders: orders.filter(o => o.kanban_status === col.key),
  }));

  return (
    <>
      <Helmet><title>Order Timeline — Trade Portal — Maison Affluency</title></Helmet>

      <div className="space-y-6">
        <BackToProjectPill />
        <div>
          <h1 className="font-display text-2xl text-foreground">Order Timeline</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Track orders from deposit through delivery.
          </p>
        </div>

        {projectFilter && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-body text-xs text-muted-foreground truncate">
                Showing timelines for project:{" "}
                <Link to={`/trade/projects/${projectFilter}`} className="text-foreground underline underline-offset-2">
                  {projectName || "loading…"}
                </Link>
              </span>
            </div>
            <button
              onClick={clearProjectFilter}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted/40 px-2 py-0.5 font-body text-[11px] text-muted-foreground"
            >
              Clear <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <PackageCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground">No active orders yet.</p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">
              Orders appear here once a deposit is paid on a confirmed quote.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {grouped.map(col => {
              const ColIcon = col.icon;
              return (
                <div key={col.key} className="min-w-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 border ${col.color}`}>
                    <ColIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-body text-[11px] font-medium truncate">{col.label}</span>
                    <span className="ml-auto font-body text-[10px] opacity-60">{col.orders.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.orders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        isAdmin={isAdmin}
                        onMoveNext={handleMoveNext}
                      />
                    ))}
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
