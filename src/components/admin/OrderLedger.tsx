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
  tax_cents: number;
  tax_label: string | null;
  buyer_tax_id: string | null;
}

type TaxAuditRow = { id: string; changed_at: string; actor_email: string | null; actor_kind: string; before_tax_cents: number | null; after_tax_cents: number; before_tax_label: string | null; after_tax_label: string | null; before_buyer_tax_id: string | null; after_buyer_tax_id: string | null; before_total_cents: number | null; after_total_cents: number; buyer_emailed: boolean };

/** Every VAT/tax change on an order: what changed, who made it and when. */
function TaxHistory({ order }: { order: OrderRow }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TaxAuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    supabase.from("shop_order_tax_audit").select("*").eq("order_id", order.id).order("changed_at", { ascending: false })
      .then(({ data, error }) => { if (error) setFailed(true); else setRows((data as TaxAuditRow[]) ?? []); });
  }, [open, order.id]);
  const diff = (label: string, a: string | null, b: string | null) => a === b ? null : <li>{label}: <span className="line-through text-muted-foreground">{a || "—"}</span> → {b || "—"}</li>;
  return <div className="w-full">
    <Button variant="ghost" size="sm" className="font-body text-xs" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide tax history" : "Tax history"}</Button>
    {open && <div className="mt-2 border-t border-border pt-3">
      {failed && <p role="alert" className="font-body text-xs text-destructive">Couldn't load the history.</p>}
      {!failed && !rows && <p className="font-body text-xs text-muted-foreground">Loading…</p>}
      {rows && !rows.length && <p className="font-body text-xs text-muted-foreground">No VAT or tax changes yet.</p>}
      {rows && rows.length > 0 && <ol className="space-y-3">{rows.map(r => <li key={r.id} className="font-body text-xs">
        <p className="text-muted-foreground">{new Date(r.changed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {r.actor_kind === "buyer" ? "Buyer at checkout" : r.actor_email || "Team member"}{r.buyer_emailed ? " · buyer emailed" : ""}</p>
        <ul className="mt-1 space-y-0.5 tabular-nums">
          {diff("VAT number", r.before_buyer_tax_id, r.after_buyer_tax_id)}
          {diff("Tax label", r.before_tax_label, r.after_tax_label)}
          {diff("Tax", r.before_tax_cents == null ? null : money(r.before_tax_cents, order.currency), money(r.after_tax_cents, order.currency))}
          {diff("Total", r.before_total_cents == null ? null : money(r.before_total_cents, order.currency), money(r.after_total_cents, order.currency))}
        </ul>
      </li>)}</ol>}
    </div>}
  </div>;
}

/** Team correction of VAT number / tax on an issued instant bank transfer. */
function InstantTaxEditor({ order, onSaved }: { order: OrderRow; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [vat, setVat] = useState(order.buyer_tax_id ?? "");
  const [label, setLabel] = useState(order.tax_label ?? "");
  const [amount, setAmount] = useState((order.tax_cents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  if (!open) return <Button variant="outline" size="sm" className="font-body text-xs" onClick={() => setOpen(true)}>Edit VAT / tax</Button>;
  const save = async () => {
    const taxCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(taxCents) || taxCents < 0) { toast({ title: "Enter a valid tax amount", variant: "destructive" }); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("update-instant-transfer-tax", {
      body: { orderId: order.id, taxCents, taxLabel: label, buyerTaxId: vat },
    });
    setSaving(false);
    const msg = (data as { error?: string })?.error;
    if (error || msg) { toast({ title: "Tax not updated", description: msg || error?.message, variant: "destructive" }); return; }
    toast({ title: `${order.order_ref} updated`, description: `Amount due is now ${money((data as { totalCents: number }).totalCents, order.currency)}.${(data as { emailed?: boolean }).emailed ? " The buyer has been emailed." : ""}` });
    setOpen(false); onSaved();
  };
  return <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3">
    <label className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">VAT number<input aria-label="VAT number" value={vat} onChange={e => setVat(e.target.value)} className="mt-1 block w-40 border border-border bg-background px-2 py-1 text-xs normal-case tracking-normal text-foreground" /></label>
    <label className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tax label<input aria-label="Tax label" value={label} onChange={e => setLabel(e.target.value)} className="mt-1 block w-40 border border-border bg-background px-2 py-1 text-xs normal-case tracking-normal text-foreground" /></label>
    <label className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tax amount<input aria-label="Tax amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 block w-28 border border-border bg-background px-2 py-1 text-xs tabular-nums text-foreground" /></label>
    <Button size="sm" className="font-body text-xs" disabled={saving} onClick={save}>{saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Save & update amount due</Button>
    <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => setOpen(false)}>Cancel</Button>
  </div>;
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
        "id, order_ref, email, full_name, status, currency, total_cents, region_tier, payment_channel, payment_method, payment_receipt_path, proforma_invoice_path, paid_at, created_at, tax_cents, tax_label, buyer_tax_id",
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
      if (order.status !== "paid") {
        window.__lovableEvents?.track?.("project.order_paid", {
          order_value_cents: order.total_cents ?? 0,
          charged_cents: order.total_cents ?? 0,
          currency: String(order.currency || "EUR").toUpperCase(),
          method: "bank_transfer",
          is_deposit: false,
          payment_status: "succeeded",
          source: "admin_marked",
        });
      }
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

              {order.payment_method === "instant_bank_transfer" && order.status !== "paid" && (
                <InstantTaxEditor order={order} onSaved={fetchRows} />
              )}
              {order.payment_method === "instant_bank_transfer" && <TaxHistory key={`${order.id}:${order.total_cents}:${order.tax_cents}`} order={order} />}
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
