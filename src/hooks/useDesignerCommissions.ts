import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PayoutStatus = "pending" | "approved" | "paid";

export interface PayoutRow {
  id: string;
  orderId: string | null;
  lineItemId: string | null;
  designerId: string | null;
  designerName: string;
  currency: string;
  grossAmount: number;
  tradeDiscountApplied: number;
  stripeFeeCents: number;
  platformFee: number;
  designerNetPayout: number;
  commissionRatePct: number;
  discountAbsorbedBy: string;
  payoutStatus: PayoutStatus;
  createdAt: string;
  productTitle: string | null;
  orderRef: string | null;
}

export interface DesignerGroup {
  designerKey: string;
  designerName: string;
  currency: string;
  rows: PayoutRow[];
  grossSales: number;
  totalDeductions: number;
  netEarnings: number;
  pendingCount: number;
}

export function useDesignerCommissions(enabled: boolean, status: "all" | PayoutStatus = "all") {
  return useQuery({
    queryKey: ["designer-commissions", status],
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<DesignerGroup[]> => {
      let q = supabase
        .from("designer_payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (status !== "all") q = q.eq("payout_status", status);
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

      const rows: PayoutRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        lineItemId: r.line_item_id,
        designerId: r.designer_id,
        designerName: r.designer_name || "Unattributed",
        currency: (r.currency || "usd").toUpperCase(),
        grossAmount: r.gross_amount ?? 0,
        tradeDiscountApplied: r.trade_discount_applied ?? 0,
        stripeFeeCents: r.stripe_fee_cents ?? 0,
        platformFee: r.platform_fee ?? 0,
        designerNetPayout: r.designer_net_payout ?? 0,
        commissionRatePct: Number(r.commission_rate_pct ?? 70),
        discountAbsorbedBy: r.discount_absorbed_by ?? "platform",
        payoutStatus: (r.payout_status ?? "pending") as PayoutStatus,
        createdAt: r.created_at,
        productTitle: r.line_item_id ? titleByLine.get(r.line_item_id) ?? null : null,
        orderRef: r.order_id ? refByOrder.get(r.order_id) ?? null : null,
      }));

      const groups = new Map<string, DesignerGroup>();
      for (const row of rows) {
        const key = `${row.designerId ?? row.designerName}|${row.currency}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            designerKey: key,
            designerName: row.designerName,
            currency: row.currency,
            rows: [],
            grossSales: 0,
            totalDeductions: 0,
            netEarnings: 0,
            pendingCount: 0,
          };
          groups.set(key, g);
        }
        g.rows.push(row);
        g.grossSales += row.grossAmount;
        g.netEarnings += row.designerNetPayout;
        g.totalDeductions +=
          row.tradeDiscountApplied + row.stripeFeeCents + row.platformFee;
        if (row.payoutStatus === "pending") g.pendingCount += 1;
      }

      return [...groups.values()].sort((a, b) => b.netEarnings - a.netEarnings);
    },
  });
}

export function useUpdatePayoutStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: PayoutStatus }) => {
      const patch: Record<string, unknown> = {
        payout_status: status,
        updated_at: new Date().toISOString(),
      };
      if (status === "approved") patch.approved_at = new Date().toISOString();
      if (status === "paid") patch.paid_at = new Date().toISOString();
      const { error } = await supabase.from("designer_payouts").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["designer-commissions"] });
    },
  });
}
