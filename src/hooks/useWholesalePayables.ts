import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus =
  | "pending"
  | "pending_invoice_match"
  | "invoice_received"
  | "approved"
  | "paid";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: "Pending",
  pending_invoice_match: "Pending invoice match",
  invoice_received: "Invoice received",
  approved: "Approved",
  paid: "Paid",
};

export interface PayableRow {
  id: string;
  orderId: string | null;
  lineItemId: string | null;
  designerId: string | null;
  designerName: string;
  currency: string;
  retailRrp: number;
  wholesaleDiscountPct: number;
  purchaseCostCogs: number;
  soldPriceGross: number;
  stripeProcessingFees: number;
  netMaisonMargin: number;
  invoiceStatus: InvoiceStatus;
  invoiceReference: string | null;
  createdAt: string;
  productTitle: string | null;
  orderRef: string | null;
  requiresFollowup: boolean;
}

export interface PayableGroup {
  designerKey: string;
  designerName: string;
  currency: string;
  rows: PayableRow[];
  soldGross: number;
  wholesalePayable: number;
  outstandingPayable: number;
  maisonMargin: number;
  pendingCount: number;
  followupCount: number;
}

export function useWholesalePayables(enabled: boolean, status: "all" | InvoiceStatus = "all") {
  return useQuery({
    queryKey: ["wholesale-payables", status],
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<PayableGroup[]> => {
      let q = supabase
        .from("purchase_orders_payable")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (status !== "all") q = q.eq("designer_invoice_status", status);
      const { data, error } = await q;
      if (error) throw error;

      const lineIds = [...new Set((data ?? []).map((r: any) => r.line_item_id).filter(Boolean))];
      const orderIds = [...new Set((data ?? []).map((r: any) => r.order_id).filter(Boolean))];

      const titleByLine = new Map<string, string>();
      if (lineIds.length) {
        const { data: items } = await supabase
          .from("shop_order_items")
          .select("id, title")
          .in("id", lineIds as string[]);
        for (const i of items ?? []) titleByLine.set(i.id, i.title ?? "");
      }
      const refByOrder = new Map<string, string>();
      if (orderIds.length) {
        const { data: orders } = await supabase
          .from("shop_orders")
          .select("id, order_ref")
          .in("id", orderIds as string[]);
        for (const o of orders ?? []) refByOrder.set(o.id, o.order_ref ?? "");
      }

      const rows: PayableRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        lineItemId: r.line_item_id,
        designerId: r.designer_id,
        designerName: r.designer_name || "Unattributed",
        currency: (r.currency || "usd").toUpperCase(),
        retailRrp: r.retail_rrp ?? 0,
        wholesaleDiscountPct: Number(r.wholesale_discount_pct ?? 30),
        purchaseCostCogs: r.purchase_cost_cogs ?? 0,
        soldPriceGross: r.sold_price_gross ?? 0,
        stripeProcessingFees: r.stripe_processing_fees ?? 0,
        netMaisonMargin: r.net_maison_margin ?? 0,
        invoiceStatus: (r.designer_invoice_status ?? "pending") as InvoiceStatus,
        invoiceReference: r.designer_invoice_reference ?? null,
        createdAt: r.created_at,
        productTitle: r.line_item_id ? titleByLine.get(r.line_item_id) ?? null : null,
        orderRef: r.order_id ? refByOrder.get(r.order_id) ?? null : null,
        requiresFollowup: Boolean(r.requires_manual_followup),
      }));

      const groups = new Map<string, PayableGroup>();
      for (const row of rows) {
        const key = `${row.designerId ?? row.designerName}|${row.currency}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            designerKey: key,
            designerName: row.designerName,
            currency: row.currency,
            rows: [],
            soldGross: 0,
            wholesalePayable: 0,
            outstandingPayable: 0,
            maisonMargin: 0,
            pendingCount: 0,
            followupCount: 0,
          };
          groups.set(key, g);
        }
        g.rows.push(row);
        g.soldGross += row.soldPriceGross;
        g.wholesalePayable += row.purchaseCostCogs;
        g.maisonMargin += row.netMaisonMargin;
        if (row.invoiceStatus !== "paid") g.outstandingPayable += row.purchaseCostCogs;
        if (row.invoiceStatus === "pending" || row.invoiceStatus === "pending_invoice_match")
          g.pendingCount += 1;
        if (row.requiresFollowup) g.followupCount += 1;
      }

      return [...groups.values()].sort((a, b) => b.outstandingPayable - a.outstandingPayable);
    },
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      status,
      invoiceReference,
    }: {
      ids: string[];
      status: InvoiceStatus;
      invoiceReference?: string;
    }) => {
      const now = new Date().toISOString();
      const patch: {
        designer_invoice_status: InvoiceStatus;
        updated_at: string;
        invoice_received_at?: string;
        approved_at?: string;
        paid_at?: string;
        designer_invoice_reference?: string;
      } = {
        designer_invoice_status: status,
        updated_at: now,
      };
      if (status === "invoice_received") patch.invoice_received_at = now;
      if (status === "approved") patch.approved_at = now;
      if (status === "paid") patch.paid_at = now;
      if (invoiceReference) patch.designer_invoice_reference = invoiceReference;
      const { error } = await supabase
        .from("purchase_orders_payable")
        .update(patch)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wholesale-payables"] });
    },
  });
}
