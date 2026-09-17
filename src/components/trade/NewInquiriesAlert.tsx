import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NewInquiry {
  id: string;
  product_name: string | null;
  company: string | null;
  email: string | null;
  created_at: string;
  status: string | null;
  linked_quote_id: string | null;
}

const relative = (dateStr: string) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function NewInquiriesAlert() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<NewInquiry[]>([]);

  const load = async () => {
    // Pending = inquiry not yet handled OR its linked quote is still a draft (not sent).
    const [{ data: inquiries, error }, { data: draftQuotes }] = await Promise.all([
      supabase
        .from("inquiries")
        .select("id, product_name, company, email, created_at, status, linked_quote_id")
        .in("status", ["new", "quote_drafted"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("trade_quotes").select("id").eq("status", "draft"),
    ]);
    if (error) return;
    const draftIds = new Set((draftQuotes ?? []).map((q) => q.id));
    const pending = (inquiries ?? []).filter(
      (i) =>
        i.status === "new" ||
        (i.linked_quote_id && draftIds.has(i.linked_quote_id))
    );
    setItems(pending.slice(0, 5) as NewInquiry[]);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel("dashboard-new-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_quotes" }, () => load())
      .subscribe();
    const poll = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin || items.length === 0) return null;

  const latest = items[0];

  return (
    <Link
      to="/trade/admin/inquiries"
      className="group mb-8 block animate-[pulse_2.5s_ease-in-out_infinite] border border-accent/60 bg-accent/10 px-5 py-4 transition-colors hover:bg-accent/20 md:px-7 md:py-5"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="relative mt-0.5 flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
              {items.length === 1
                ? "1 new quote request awaiting reply"
                : `${items.length}+ new quote requests awaiting reply`}
            </p>
            <p className="mt-1 truncate font-body text-sm text-muted-foreground">
              {latest.product_name ?? "Quote request"}
              {" · "}
              {latest.company || latest.email || "Private client"}
              {" · "}
              {relative(latest.created_at)}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
          <Inbox className="h-4 w-4" />
          Review
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
