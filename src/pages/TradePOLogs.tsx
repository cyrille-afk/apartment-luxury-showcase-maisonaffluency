/**
 * Purchase Order Logs Dashboard
 *
 * Back-office three-way match view: PO -> supplier invoice -> payment.
 * Rows come from `trade_quote_items` that carry a generated PO reference.
 */

import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Banknote, ClipboardList, FileWarning, Search, Wallet, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatMoneyIn } from "@/lib/displayMoney";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type InvoiceStatus = "missing" | "received" | "under_review";
type PaymentStatus = "unpaid" | "deposit_settled" | "fully_paid";

interface PORow {
  item_id: string;
  po_number: string;
  quote_id: string;
  quote_ref: string;
  product_name: string;
  brand_name: string;
  supplier_name: string;
  quantity: number;
  total_cents: number;
  currency: string;
  invoice_status: InvoiceStatus;
  invoice_total_cents: number | null;
  payment_status: PaymentStatus;
  due_date: string | null;
  deposit_paid_at: string | null;
  balance_due_date: string | null;
  fully_paid_at: string | null;
  project_name: string | null;
  client_name: string | null;
}

const INVOICE_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "missing", label: "Missing" },
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under Review" },
];

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "deposit_settled", label: "Deposit Settled" },
  { value: "fully_paid", label: "Fully Paid" },
];

const QUOTE_REF = (id: string) => `Q-${id.slice(0, 8).toUpperCase()}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** A received invoice whose total differs from the PO amount is a match break. */
const isMismatched = (row: PORow) =>
  row.invoice_status !== "missing" &&
  row.invoice_total_cents != null &&
  row.invoice_total_cents !== row.total_cents;

/** Vendor money still owed on this PO. */
const outstandingCents = (row: PORow) => {
  if (row.payment_status === "fully_paid") return 0;
  if (row.payment_status === "deposit_settled") return Math.round(row.total_cents / 2);
  return row.total_cents;
};

/* ------------------------------------------------------------------ */

export default function TradePOLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectFilter, clearProjectFilter } = useProjectFilter();

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const queryKey = ["po-logs", user?.id, projectFilter];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PORow[]> => {
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, project_id")
        .eq("user_id", user!.id);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;
      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select(
          "id, quote_id, product_id, quantity, unit_price_cents, po_number, supplier_id, " +
            "supplier_invoice_status, supplier_invoice_total_cents, po_payment_status, " +
            "po_due_date, po_deposit_paid_at, po_balance_due_date, po_fully_paid_at, required_by_date",
        )
        .in("quote_id", quoteIds)
        .not("po_number", "is", null);
      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i: any) => i.product_id).filter(Boolean))];
      const { data: products } = productIds.length
        ? await supabase
            .from("trade_products")
            .select("id, product_name, brand_name, currency")
            .in("id", productIds)
        : { data: [] as any[] };

      const supplierIds = [...new Set(qItems.map((i: any) => i.supplier_id).filter(Boolean))] as string[];
      const { data: suppliers } = supplierIds.length
        ? await supabase.from("suppliers").select("id, supplier_name").in("id", supplierIds)
        : { data: [] as any[] };

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries(((products as any[]) || []).map((p) => [p.id, p]));
      const supplierMap = Object.fromEntries(((suppliers as any[]) || []).map((s) => [s.id, s.supplier_name]));
      const quoteMap = Object.fromEntries((quotes as any[]).map((q) => [q.id, q]));
      const projectMap = Object.fromEntries(((projects as any[]) || []).map((p) => [p.id, p.name]));

      return (qItems as any[]).map((item) => {
        const p: any = productMap[item.product_id];
        const q: any = quoteMap[item.quote_id];
        return {
          item_id: item.id,
          po_number: item.po_number,
          quote_id: item.quote_id,
          quote_ref: QUOTE_REF(item.quote_id),
          product_name: p?.product_name || "Unknown item",
          brand_name: p?.brand_name || "",
          supplier_name: supplierMap[item.supplier_id] || p?.brand_name || "Unassigned supplier",
          quantity: item.quantity || 1,
          total_cents: (item.unit_price_cents || 0) * (item.quantity || 1),
          currency: p?.currency || "EUR",
          invoice_status: (item.supplier_invoice_status || "missing") as InvoiceStatus,
          invoice_total_cents: item.supplier_invoice_total_cents ?? null,
          payment_status: (item.po_payment_status || "unpaid") as PaymentStatus,
          due_date: item.po_due_date || item.required_by_date || null,
          deposit_paid_at: item.po_deposit_paid_at || null,
          balance_due_date: item.po_balance_due_date || null,
          fully_paid_at: item.po_fully_paid_at || null,
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          client_name: q?.client_name || null,
        } as PORow;
      });
    },
    enabled: !!user,
  });

  const currency = rows[0]?.currency || "EUR";

  const displayed = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.po_number, r.quote_ref, r.supplier_name, r.product_name, r.brand_name, r.project_name, r.client_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const drafted = displayed.length;
    const awaiting = displayed.filter((r) => r.invoice_status !== "received").length;
    const paid = displayed.filter((r) => r.payment_status !== "unpaid").length;
    const outstanding = displayed.reduce((sum, r) => sum + outstandingCents(r), 0);
    return [
      { label: "Total POs Drafted", value: String(drafted), icon: ClipboardList, alert: false },
      { label: "Awaiting Supplier Invoice", value: String(awaiting), icon: FileWarning, alert: awaiting > 0 },
      { label: "Paid / Processing", value: String(paid), icon: Banknote, alert: false },
      {
        label: "Total Vendor Balances Outstanding",
        value: formatMoneyIn(outstanding, currency, formatMoneyIn(0, currency, "—")),
        icon: Wallet,
        alert: false,
      },
    ];
  }, [displayed, currency]);

  const active = useMemo(() => displayed.find((r) => r.item_id === openId) || null, [displayed, openId]);

  /* --- mutations ---------------------------------------------------- */

  const patchRow = async (row: PORow, patch: Record<string, unknown>, message: string) => {
    setSaving(true);
    const { error } = await supabase.from("trade_quote_items").update(patch as never).eq("id", row.item_id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ["ffe-schedule"] });
    toast({ title: message, description: row.po_number });
  };

  const openRow = (row: PORow) => {
    setOpenId(row.item_id);
    setInvoiceDraft(row.invoice_total_cents != null ? String(row.invoice_total_cents / 100) : "");
  };

  const markFullyPaid = (row: PORow) =>
    patchRow(
      row,
      {
        po_payment_status: "fully_paid",
        po_fully_paid_at: new Date().toISOString(),
        po_deposit_paid_at: row.deposit_paid_at || new Date().toISOString(),
      },
      "Marked fully paid",
    );

  const saveInvoiceTotal = (row: PORow) => {
    const parsed = invoiceDraft.trim() === "" ? null : Math.round(Number(invoiceDraft) * 100);
    if (parsed != null && !Number.isFinite(parsed)) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    patchRow(row, { supplier_invoice_total_cents: parsed }, "Invoice total saved");
  };

  /* --- render ------------------------------------------------------- */

  return (
    <>
      <Helmet>
        <title>Purchase Order Logs — Trade Portal</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="w-[95%] max-w-[1800px] mx-auto space-y-6">
        <TradeBreadcrumb />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-foreground">Purchase Order Logs</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Three-way match between purchase orders, supplier invoices and vendor payments.
            </p>
          </div>
          {projectFilter && (
            <button
              onClick={clearProjectFilter}
              className="inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear project filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <DotCircleLoader size="sm" className="text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    "rounded-lg border bg-card p-4 transition-colors duration-300",
                    c.alert ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</p>
                  </div>
                  <p className="mt-2 font-display text-2xl text-foreground">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO, quote, supplier…"
                className="pl-9"
              />
            </div>

            {/* Match table */}
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[1100px] text-left">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3 font-normal">PO Reference</th>
                      <th className="px-4 py-3 font-normal">Linked Quote</th>
                      <th className="px-4 py-3 font-normal">Supplier</th>
                      <th className="px-4 py-3 font-normal text-right">Total Amount</th>
                      <th className="px-4 py-3 font-normal">Supplier Invoice</th>
                      <th className="px-4 py-3 font-normal">Payment</th>
                      <th className="px-4 py-3 font-normal">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayed.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                          <p className="font-body text-sm text-muted-foreground">
                            No purchase orders logged yet. Generate a PO reference from a quote line to track it here.
                          </p>
                        </td>
                      </tr>
                    )}
                    {displayed.map((row) => {
                      const mismatch = isMismatched(row);
                      return (
                        <tr
                          key={row.item_id}
                          onClick={() => openRow(row)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            mismatch ? "bg-amber-500/[0.07] hover:bg-amber-500/[0.12]" : "hover:bg-muted/40",
                          )}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-foreground">{row.po_number}</span>
                            <span className="block font-body text-[11px] text-muted-foreground">{row.product_name}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{row.quote_ref}</td>
                          <td className="px-4 py-3 font-body text-xs text-foreground">{row.supplier_name}</td>
                          <td className="px-4 py-3 text-right font-body text-xs tabular-nums text-foreground">
                            {formatMoneyIn(row.total_cents, row.currency)}
                            {mismatch && (
                              <span className="mt-0.5 flex items-center justify-end gap-1 font-body text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                Invoiced {formatMoneyIn(row.invoice_total_cents, row.currency)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={row.invoice_status}
                              onValueChange={(v) =>
                                patchRow(row, { supplier_invoice_status: v }, "Invoice status updated")
                              }
                            >
                              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {INVOICE_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={row.payment_status}
                              onValueChange={(v) =>
                                patchRow(
                                  row,
                                  {
                                    po_payment_status: v,
                                    po_fully_paid_at: v === "fully_paid" ? new Date().toISOString() : null,
                                    po_deposit_paid_at:
                                      v === "unpaid" ? null : row.deposit_paid_at || new Date().toISOString(),
                                  },
                                  "Payment status updated",
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 font-body text-xs text-muted-foreground">{formatDate(row.due_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment schedule drawer */}
      <Sheet open={!!active} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-lg">{active.po_number}</SheetTitle>
                <SheetDescription className="font-body text-xs">
                  {active.supplier_name} · {active.quote_ref}
                  {active.project_name ? ` · ${active.project_name}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="rounded-lg border border-border p-4">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">PO Total</p>
                  <p className="mt-1 font-display text-xl text-foreground">
                    {formatMoneyIn(active.total_cents, active.currency)}
                  </p>
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">
                    {active.product_name} × {active.quantity}
                  </p>
                </div>

                {/* Transaction ledger */}
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                    Transaction Ledger
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="font-body text-xs text-foreground">
                        50% Production Deposit —{" "}
                        {formatMoneyIn(Math.round(active.total_cents / 2), active.currency)}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-muted-foreground">
                        {active.payment_status === "unpaid"
                          ? `Due by ${formatDate(active.due_date)}`
                          : `Paid on ${formatDate(active.deposit_paid_at || active.fully_paid_at)}`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="font-body text-xs text-foreground">
                        50% Shipping Balance —{" "}
                        {formatMoneyIn(active.total_cents - Math.round(active.total_cents / 2), active.currency)}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-muted-foreground">
                        {active.payment_status === "fully_paid"
                          ? `Paid on ${formatDate(active.fully_paid_at)}`
                          : `Due by ${formatDate(active.balance_due_date || active.due_date)}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 font-body text-[11px] text-muted-foreground">
                    Outstanding vendor balance:{" "}
                    <span className="text-foreground">
                      {formatMoneyIn(outstandingCents(active), active.currency, formatMoneyIn(0, active.currency, "—"))}
                    </span>
                  </p>
                </div>

                {/* Invoice reconciliation */}
                <div className="space-y-2">
                  <Label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                    Supplier invoice total
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={invoiceDraft}
                      onChange={(e) => setInvoiceDraft(e.target.value)}
                      inputMode="decimal"
                      placeholder={String(Math.round(active.total_cents / 100))}
                    />
                    <Button variant="outline" disabled={saving} onClick={() => saveInvoiceTotal(active)}>
                      Save
                    </Button>
                  </div>
                  {isMismatched(active) && (
                    <p className="flex items-center gap-1 font-body text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Invoice deviates from the purchase order amount.
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  disabled={saving || active.payment_status === "fully_paid"}
                  onClick={() => markFullyPaid(active)}
                >
                  {active.payment_status === "fully_paid" ? "Fully paid" : "Mark as Fully Paid"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
