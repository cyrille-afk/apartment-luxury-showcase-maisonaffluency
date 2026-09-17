import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CheckCircle2, Loader2, Printer, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useToast } from "@/hooks/use-toast";
import { purchaseOrderPdfBase64 } from "@/lib/purchaseOrderPdf";

export type POApprovalStatus = "pending" | "approved" | "changes_requested";

interface SupplierRecord {
  id: string;
  supplier_name: string;
  contact_email: string;
  cc_email: string | null;
  brand_aliases?: string[] | null;
}


export interface PODocumentData {
  item_id?: string;
  po_number: string;
  quote_ref: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  client_name?: string | null;
  project_name?: string | null;
  cost_code?: string | null;
  sku?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  lead_time?: string | null;
  required_by_date?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  po_status?: POApprovalStatus | string | null;
  po_approved_by_name?: string | null;
  po_approved_at?: string | null;
}

interface Props {
  document: PODocumentData | null;
  onOpenChange: (open: boolean) => void;
  /** Notifies the parent drawer so its badge updates without a page reload. */
  onStatusChange?: (next: {
    po_status: POApprovalStatus;
    po_approved_by_name: string | null;
    po_approved_at: string | null;
  }) => void;
}

const statusLabel = (status: string) =>
  status === "approved" ? "Approved" : status === "changes_requested" ? "Changes requested" : "Pending review";

const stampTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const money = (cents: number | null | undefined, currency: string) =>
  cents == null
    ? "Price upon Request"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);

const longDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function PODocumentViewer({ document: po, onOpenChange, onStatusChange }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, profile, isAdmin: isPlatformAdmin, isSuperAdmin } = useAuth();
  const { isAdmin: isStudioManager } = useStudio();
  const canSignOff = Boolean(user) && (isPlatformAdmin || isSuperAdmin || isStudioManager);

  const [pendingAction, setPendingAction] = useState<"approved" | "changes_requested" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localStatus, setLocalStatus] = useState<{
    po_status: POApprovalStatus;
    po_approved_by_name: string | null;
    po_approved_at: string | null;
  } | null>(null);
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedTo, setDispatchedTo] = useState<string | null>(null);


  const status = (localStatus?.po_status ?? (po?.po_status as POApprovalStatus) ?? "pending") as POApprovalStatus;
  const approverName = localStatus?.po_approved_by_name ?? po?.po_approved_by_name ?? null;
  const approvedAt = localStatus?.po_approved_at ?? po?.po_approved_at ?? null;

  // A different line opened in the viewer must not inherit the previous sign-off.
  useEffect(() => {
    setLocalStatus(null);
    setPendingAction(null);
    setSupplier(null);
  }, [po?.item_id]);

  // Resolve the supplier for this PO's brand (exact name or registered alias).
  useEffect(() => {
    const brand = po?.brand_name?.trim().toLowerCase();
    if (!brand) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, supplier_name, contact_email, cc_email, brand_aliases")
        .eq("active", true)
        .limit(1000);
      if (cancelled) return;
      const match =
        (data ?? []).find(
          (s) =>
            s.supplier_name.trim().toLowerCase() === brand ||
            (s.brand_aliases ?? []).some((a: string) => a.trim().toLowerCase() === brand),
        ) ?? null;
      setSupplier(match);
    })();
    return () => {
      cancelled = true;
    };
  }, [po?.brand_name, po?.item_id]);

  const managerName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.email || "Studio manager";

  /** Compiles the approved PO as a PDF and emails it to the resolved supplier. */
  const dispatchToSupplier = async (approvedAtStamp: string) => {
    if (!po?.item_id) return;
    if (!supplier?.contact_email) {
      toast({
        title: "No supplier email on file",
        description: `Add a supplier contact for ${po.brand_name} to dispatch this purchase order automatically.`,
      });
      return;
    }
    setDispatching(true);
    toast({
      title: "PO approved",
      description: `Dispatching document to ${supplier.contact_email}…`,
    });
    try {
      const pdfBase64 = purchaseOrderPdfBase64({
        poNumber: po.po_number,
        quoteRef: po.quote_ref,
        currency: po.currency || "EUR",
        supplierName: supplier.supplier_name,
        clientName: po.client_name,
        projectName: po.project_name,
        costCode: po.cost_code,
        requiredBy: po.required_by_date,
        leadTime: po.lead_time,
        productName: po.product_name,
        brandName: po.brand_name,
        sku: po.sku,
        dimensions: po.dimensions,
        materials: po.materials,
        quantity: po.quantity,
        unitCents: po.price_cents ?? null,
        approvedByName: managerName,
        approvedAt: approvedAtStamp,
      });
      const { data, error } = await supabase.functions.invoke("send-purchase-order", {
        body: { itemId: po.item_id, pdfBase64 },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error || error?.message || "Dispatch failed");
      }
      setDispatchedTo(supplier.contact_email);
      toast({
        title: "Purchase order dispatched",
        description: `${po.po_number} sent to ${supplier.contact_email}${supplier.cc_email ? ` (cc ${supplier.cc_email})` : ""}.`,
      });
    } catch (err) {
      toast({
        title: "Supplier dispatch failed",
        description: err instanceof Error ? err.message : "The purchase order was approved but not emailed.",
        variant: "destructive",
      });
    } finally {
      setDispatching(false);
    }
  };

  const applyDecision = async (next: "approved" | "changes_requested") => {
    if (!po?.item_id) return;
    setSubmitting(true);
    const stamp = new Date().toISOString();
    const payload =
      next === "approved"
        ? { po_status: "approved", po_approved_by: user?.id ?? null, po_approved_by_name: managerName, po_approved_at: stamp }
        : { po_status: "changes_requested", po_approved_by: user?.id ?? null, po_approved_by_name: managerName, po_approved_at: stamp };
    const { error } = await supabase.from("trade_quote_items").update(payload).eq("id", po.item_id);
    setSubmitting(false);
    setPendingAction(null);
    if (error) {
      toast({ title: "Sign-off failed", description: error.message, variant: "destructive" });
      return;
    }
    const applied = {
      po_status: next as POApprovalStatus,
      po_approved_by_name: managerName,
      po_approved_at: stamp,
    };
    setLocalStatus(applied);
    onStatusChange?.(applied);
    if (next === "approved") {
      void dispatchToSupplier(stamp);
      return;
    }
    toast({
      title: "Changes requested",
      description: `${po.po_number} is now marked ${statusLabel(next).toLowerCase()}.`,
    });
  };


  /** Print the document sheet alone, via an isolated iframe so the app behind stays untouched. */
  const print = () => {
    const node = sheetRef.current;
    if (!node) return;
    const frame = window.document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    window.document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    const styles = Array.from(window.document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join("");
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>${po?.po_number || "Purchase Order"}</title>${styles}` +
        `<style>@page{size:A4;margin:14mm}body{background:#fff;margin:0}</style></head>` +
        `<body>${node.outerHTML}</body></html>`,
    );
    doc.close();
    const run = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    };
    if (frame.contentWindow?.document.readyState === "complete") window.setTimeout(run, 250);
    else frame.onload = () => window.setTimeout(run, 250);
  };

  const currency = po?.currency || "EUR";
  const lineTotal = po?.price_cents != null ? po.price_cents * po.quantity : null;

  return (
    <Dialog open={!!po} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-h-[92dvh] w-[min(96vw,900px)] max-w-none gap-0 overflow-hidden p-0"
      >
        {po && (
          <>
            <DialogTitle className="sr-only">Purchase order {po.po_number}</DialogTitle>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Purchase order</p>
                <p className="font-display text-base text-foreground">{po.po_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="font-body text-xs" onClick={print}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print / Download PDF
                </Button>
                <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => onOpenChange(false)}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Close view
                </Button>
              </div>
            </div>

            <div className="max-h-[calc(92dvh-56px)] overflow-y-auto bg-muted/40 p-4 sm:p-8">
              <div ref={sheetRef} className="mx-auto w-full max-w-[794px] bg-background p-8 shadow-sm sm:p-12">
                <header className="flex items-start justify-between gap-6 border-b border-border pb-6">
                  <div>
                    <p className="font-display text-xl text-foreground">Maison Affluency</p>
                    <p className="mt-1 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Trade procurement
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Purchase order</p>
                    <p className="font-display text-lg text-foreground">{po.po_number}</p>
                    <p className="mt-1 font-body text-xs text-muted-foreground">Issued {longDate(new Date().toISOString())}</p>
                  </div>
                </header>

                <section className="mt-6 grid gap-6 font-body text-xs sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Client</p>
                    <p className="mt-1 text-foreground">{po.client_name || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Project</p>
                    <p className="mt-1 text-foreground">{po.project_name || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Quote reference</p>
                    <p className="mt-1 text-foreground">{po.quote_ref}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Cost code</p>
                    <p className="mt-1 text-foreground">{po.cost_code || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Required by</p>
                    <p className="mt-1 text-foreground">{longDate(po.required_by_date)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Lead time</p>
                    <p className="mt-1 text-foreground">{po.lead_time || "—"}</p>
                  </div>
                </section>

                <table className="mt-8 w-full border-collapse font-body text-xs">
                  <thead>
                    <tr className="border-y border-border text-left uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="py-2 pr-3 font-normal">Description</th>
                      <th className="py-2 px-3 font-normal">SKU</th>
                      <th className="py-2 px-3 text-right font-normal">Qty</th>
                      <th className="py-2 px-3 text-right font-normal">Unit</th>
                      <th className="py-2 pl-3 text-right font-normal">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border align-top">
                      <td className="py-3 pr-3">
                        <p className="font-display text-sm text-foreground">{po.product_name}</p>
                        <p className="mt-0.5 uppercase tracking-[0.14em] text-muted-foreground">{po.brand_name}</p>
                        {(po.dimensions || po.materials) && (
                          <p className="mt-1.5 text-muted-foreground">
                            {[po.dimensions, po.materials].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{po.sku || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{po.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{money(po.price_cents, currency)}</td>
                      <td className="py-3 pl-3 text-right tabular-nums text-foreground">{money(lineTotal, currency)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-3 pr-3 text-right uppercase tracking-[0.14em] text-muted-foreground">
                        Order total
                      </td>
                      <td className="py-3 pl-3 text-right font-display text-sm tabular-nums text-foreground">
                        {money(lineTotal, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <section className="mt-8 border-t border-border pt-5 font-body text-[11px] leading-relaxed text-muted-foreground">
                  <p className="uppercase tracking-[0.16em] text-foreground">Terms</p>
                  <p className="mt-2">
                    This purchase order is issued against the referenced trade quote. Supplier confirmation of lead time and
                    ex-works readiness is required within five business days. Goods must be inspected, protected and labelled
                    with the purchase order reference prior to collection. Invoices quoting this reference are settled per the
                    agreed trade payment schedule.
                  </p>
                </section>

                <section className="mt-10 grid gap-10 font-body text-[11px] sm:grid-cols-2">
                  <div>
                    <div className="h-10 border-b border-border" />
                    <p className="mt-2 uppercase tracking-[0.16em] text-muted-foreground">Approved by · Maison Affluency</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-border" />
                    <p className="mt-2 uppercase tracking-[0.16em] text-muted-foreground">Supplier acknowledgement · Date</p>
                  </div>
                </section>

                <section className="mt-10 border-t border-border pt-6">
                  <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Manager sign-off</p>

                  {status === "approved" ? (
                    <div className="mt-4 inline-flex animate-fade-in items-start gap-3 rounded-sm border-2 border-emerald-600/60 bg-emerald-50/70 px-5 py-4">
                      <BadgeCheck className="mt-0.5 h-6 w-6 text-emerald-700" />
                      <div>
                        <p className="font-display text-base tracking-wide text-emerald-800">Approved</p>
                        <p className="mt-0.5 font-body text-[11px] text-emerald-800/90">{approverName || "Studio manager"}</p>
                        <p className="font-body text-[11px] text-emerald-800/70">{stampTime(approvedAt)}</p>
                      </div>
                    </div>
                  ) : null}

                  {status === "approved" && (
                    <p className="mt-3 font-body text-[11px] text-muted-foreground">
                      {dispatching ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Dispatching document to {supplier?.contact_email}…
                        </span>
                      ) : dispatchedTo ? (
                        <span className="inline-flex items-center gap-2 text-emerald-700">
                          <Send className="h-3 w-3" />
                          Dispatched to {dispatchedTo}
                          {supplier?.cc_email ? ` · cc ${supplier.cc_email}` : ""}
                        </span>
                      ) : supplier?.contact_email ? (
                        `Supplier on file: ${supplier.supplier_name} · ${supplier.contact_email}`
                      ) : (
                        `No supplier email on file for ${po.brand_name}.`
                      )}
                    </p>
                  )}

                  {status === "approved" ? null : status === "changes_requested" ? (

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 font-body text-[11px] uppercase tracking-[0.16em] text-amber-800">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Status: Changes requested
                      </span>
                      {canSignOff && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 font-body text-xs text-white hover:bg-emerald-700"
                          onClick={() => setPendingAction("approved")}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Approve purchase order
                        </Button>
                      )}
                    </div>
                  ) : canSignOff ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        className="bg-emerald-600 font-body text-xs text-white hover:bg-emerald-700"
                        onClick={() => setPendingAction("approved")}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Approve purchase order
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-body text-xs"
                        onClick={() => setPendingAction("changes_requested")}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Request changes
                      </Button>
                    </div>
                  ) : (
                    <span className="mt-4 inline-flex items-center rounded-sm border border-border bg-muted/50 px-3 py-2 font-body text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Status: Pending review
                    </span>
                  )}
                </section>
              </div>
            </div>

            <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-xl font-normal">
                    {pendingAction === "approved" ? `Approve ${po.po_number}?` : `Request changes on ${po.po_number}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-body text-sm">
                    {pendingAction === "approved"
                      ? "This records your sign-off on the purchase order with your name and a time stamp."
                      : "This marks the purchase order as requiring changes before it can be issued."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-body text-xs"
                    disabled={submitting}
                    onClick={(event) => {
                      event.preventDefault();
                      if (pendingAction) void applyDecision(pendingAction);
                    }}
                  >
                    {submitting ? "Saving…" : pendingAction === "approved" ? "Approve" : "Request changes"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
