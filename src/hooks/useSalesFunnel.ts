import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunnelEntry {
  id: string;
  label: string;
  sublabel: string | null;
  createdAt: string;
  amountLabel: string | null;
  href: string | null;
  email: string | null;
}

export interface FunnelStage {
  key: string;
  title: string;
  description: string;
  entries: FunnelEntry[];
}

export interface SalesFunnelData {
  stages: FunnelStage[];
  converted: number;
  reminders: {
    id: string;
    stage: string;
    recipient_email: string | null;
    audience: string;
    sent_at: string;
    reminder_number: number;
  }[];
}

const money = (cents: number | null | undefined, currency: string | null | undefined) =>
  cents == null
    ? null
    : `${(currency || "EUR").toUpperCase()} ${(cents / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export function useSalesFunnel(days: number) {
  return useQuery<SalesFunnelData>({
    queryKey: ["sales-funnel", days],
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const [inquiriesRes, quotesRes, linksRes, cartsRes, ordersRes, remindersRes] =
        await Promise.all([
          supabase
            .from("inquiries")
            .select("id, product_name, company, email, created_at, status, linked_quote_id")
            .gte("created_at", since)
            .order("created_at", { ascending: false }),
          supabase
            .from("trade_quotes")
            .select("id, client_name, currency, status, created_at, submitted_at, ship_to_email")
            .gte("created_at", since)
            .order("created_at", { ascending: false }),
          supabase
            .from("quote_payment_links")
            .select("id, quote_id, amount_cents, currency, status, payer_email, created_at, paid_at"),
          supabase
            .from("abandoned_carts")
            .select("*")
            .gte("created_at", since)
            .order("last_activity_at", { ascending: false }),
          supabase
            .from("shop_orders")
            .select("id, order_ref, email, status, total_cents, currency, created_at")
            .gte("created_at", since),
          supabase
            .from("funnel_reminder_log")
            .select("id, stage, recipient_email, audience, sent_at, reminder_number")
            .order("sent_at", { ascending: false })
            .limit(40),
        ]);

      const inquiries = inquiriesRes.data ?? [];
      const quotes = quotesRes.data ?? [];
      const links = linksRes.data ?? [];
      const carts = cartsRes.data ?? [];
      const orders = ordersRes.data ?? [];

      const paidQuoteIds = new Set(
        links.filter((l) => l.status === "paid").map((l) => l.quote_id as string),
      );
      const linkByQuote = new Map<string, (typeof links)[number]>();
      for (const l of links) if (!linkByQuote.has(l.quote_id as string)) linkByQuote.set(l.quote_id as string, l);

      const ref = (id: string) => `QU-${id.slice(0, 6).toUpperCase()}`;

      const notQuoted = inquiries.filter(
        (i) => !i.linked_quote_id && ["new", "in_review"].includes(i.status ?? "new"),
      );
      const draftQuotes = quotes.filter((q) => q.status === "draft");
      const sentUnpaid = quotes.filter(
        (q) => q.status === "submitted" && !paidQuoteIds.has(q.id as string),
      );
      const activeCarts = carts.filter((c) => c.status === "active");
      const pendingOrders = orders.filter((o) => o.status === "pending");

      const stages: FunnelStage[] = [
        {
          key: "abandoned_bags",
          title: "Shopping bags left behind",
          description: "Pieces added to a bag with no order placed",
          entries: activeCarts.map((c) => ({
            id: c.id as string,
            label: (Array.isArray(c.items) && (c.items as any[])[0]?.title) || "Shopping bag",
            sublabel: [
              c.email || "No email captured",
              `${c.item_count} item${c.item_count === 1 ? "" : "s"}`,
              c.reminder_count ? `${c.reminder_count} reminder sent` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            createdAt: (c.last_activity_at as string) ?? (c.created_at as string),
            amountLabel: money(c.subtotal_cents as number, c.currency as string),
            href: null,
            email: (c.email as string) ?? null,
          })),
        },
        {
          key: "not_quoted",
          title: "Requests without a quote",
          description: "Quote requests that never reached a draft",
          entries: notQuoted.map((i) => ({
            id: i.id as string,
            label: i.product_name ?? "Quote request",
            sublabel: i.company || i.email || "Private client",
            createdAt: i.created_at as string,
            amountLabel: null,
            href: "/trade/admin/inquiries",
            email: (i.email as string) ?? null,
          })),
        },
        {
          key: "draft_quotes",
          title: "Quotes never sent",
          description: "Drafts still sitting with the trade desk",
          entries: draftQuotes.map((q) => ({
            id: q.id as string,
            label: ref(q.id as string),
            sublabel: q.client_name ?? "Unnamed client",
            createdAt: q.created_at as string,
            amountLabel: null,
            href: `/trade/quotes/${q.id}`,
            email: (q.ship_to_email as string) ?? null,
          })),
        },
        {
          key: "sent_unpaid",
          title: "Quotes sent, not paid",
          description: "Issued quotations awaiting settlement",
          entries: sentUnpaid.map((q) => {
            const link = linkByQuote.get(q.id as string);
            return {
              id: q.id as string,
              label: ref(q.id as string),
              sublabel: [q.client_name ?? "Client", link ? "Pay link issued" : "No pay link"]
                .filter(Boolean)
                .join(" · "),
              createdAt: (q.submitted_at as string) ?? (q.created_at as string),
              amountLabel: link ? money(link.amount_cents as number, link.currency as string) : null,
              href: `/trade/quotes/${q.id}`,
              email: (link?.payer_email as string) ?? (q.ship_to_email as string) ?? null,
            };
          }),
        },
        {
          key: "orders_pending",
          title: "Orders awaiting payment",
          description: "Checkouts started but never settled",
          entries: pendingOrders.map((o) => ({
            id: o.id as string,
            label: (o.order_ref as string) ?? "Order",
            sublabel: (o.email as string) ?? "Guest",
            createdAt: o.created_at as string,
            amountLabel: money(o.total_cents as number, o.currency as string),
            href: null,
            email: (o.email as string) ?? null,
          })),
        },
      ];

      const converted =
        orders.filter((o) => o.status === "paid").length + paidQuoteIds.size;

      return { stages, converted, reminders: remindersRes.data ?? [] };
    },
  });
}
