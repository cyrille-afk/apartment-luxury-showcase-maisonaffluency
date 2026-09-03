/**
 * Order Ledger — reconciliation desk for bank-settled (pro-forma) orders.
 *
 * Lists every order with its region, settlement channel, totals and evidence
 * (uploaded remittance receipt, generated pro-forma invoice), and lets an admin
 * mark payment as received — which confirms the order and emails the buyer once.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Check, FileText, Loader2, Receipt, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  order_ref: string;
  email: string | null;
  full_name: string | null;
  status: string;
  currency: string;
  total_cents: number;
  region_tier: string | null;
  payment_channel: string | null;
  payment_method: string;
  payment_receipt_path: string | null;
  proforma_invoice_path: string | null;
  paid_at: string | null;
  created_at: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  paynow: "Corporate PayNow",
  fast: "Local FAST transfer",
  swift: "International SWIFT",
};

const STATUS_FILTERS = [
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "paid", label: "Paid" },
  { id: "all", label: "All orders" },
] as const;

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));

export default function OrderLedger() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("awaiting_payment");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("shop_orders")
      .select(
        "id, order_ref, email, full_name, status, currency, total_cents, region_tier, payment_channel, payment_method, payment_receipt_path, proforma_invoice_path, paid_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("order ledger fetch failed:", error);
      toast({ title: "Could not load orders", variant: "destructive" });
    }
    setRows((data as OrderRow[]) || []);
    setFetching(false);
  }, [toast]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const openFile = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open the document", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const markPaid = async (order: OrderRow) => {
    setBusy(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("mark-order-paid", {
        body: { orderId: order.id },
      });
      if (error) throw error;
      toast({
        title: `${order.order_ref} marked paid`,
        description: (data as { emailed?: boolean })?.emailed
          ? "Confirmation email sent to the client."
          : "Confirmation email was already sent.",
      });
      await fetchRows();
    } catch (e) {
      toast({
        title: "Could not mark the order paid",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.18em] transition-colors",
                filter === f.id ? "border-foreground" : "border-border text-muted-foreground hover:border-neutral-400",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRows} disabled={fetching} className="font-body text-xs">
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", fetching && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {fetching && <p className="font-body text-sm text-muted-foreground">Loading ledger…</p>}

      {!fetching && visible.length === 0 && (
        <div className="rounded-sm border border-border py-20 text-center">
          <Check className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-body text-sm text-muted-foreground">No orders in this view.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((order) => (
          <article key={order.id} className="border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {order.region_tier || "ROW"} ·{" "}
                  {CHANNEL_LABEL[order.payment_channel || ""] || order.payment_method}
                </p>
                <h3 className="mt-1 font-display text-lg tabular-nums">{order.order_ref}</h3>
                <p className="font-body text-xs text-muted-foreground">
                  {order.full_name || "—"} · {order.email || "—"} ·{" "}
                  {new Date(order.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-body text-lg tabular-nums">{money(order.total_cents, order.currency)}</p>
                <p
                  className={cn(
                    "font-body text-[10px] uppercase tracking-[0.24em]",
                    order.status === "paid" ? "text-emerald-700" : "text-amber-700",
                  )}
                >
                  {order.status.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {order.proforma_invoice_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-body text-xs"
                  onClick={() => openFile("proforma-invoices", order.proforma_invoice_path!)}
                >
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  Pro-forma invoice
                </Button>
              )}
              {order.payment_receipt_path ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-body text-xs"
                  onClick={() => openFile("payment-receipts", order.payment_receipt_path!)}
                >
                  <Receipt className="mr-2 h-3.5 w-3.5" />
                  Payment receipt
                </Button>
              ) : (
                <span className="font-body text-xs text-muted-foreground">No receipt attached</span>
              )}

              {order.status !== "paid" && (
                <Button
                  size="sm"
                  className="ml-auto font-body text-xs"
                  disabled={busy === order.id}
                  onClick={() => markPaid(order)}
                >
                  {busy === order.id ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-3.5 w-3.5" />
                  )}
                  Mark payment received
                </Button>
              )}
              {order.paid_at && (
                <span className="ml-auto font-body text-xs text-muted-foreground">
                  Cleared{" "}
                  {new Date(order.paid_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
