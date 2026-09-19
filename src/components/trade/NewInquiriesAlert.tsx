import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTables } from "@/contexts/RealtimeMultiplexerContext";

interface NewInquiry {
  id: string;
  product_name: string | null;
  company: string | null;
  email: string | null;
  created_at: string;
  status: string | null;
  linked_quote_id: string | null;
}

const STAGE_LABEL: Record<string, string> = {
  new: "Open — not yet handled",
  in_review: "Being handled",
  quote_drafted: "Quote drafted",
  ready_to_send: "Ready to send",
};

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
    // Pending = anything not yet sent/closed/rejected, or whose linked quote is still a draft.
    const [{ data: inquiries, error }, { data: draftQuotes }] = await Promise.all([
      supabase
        .from("inquiries")
        .select("id, product_name, company, email, created_at, status, linked_quote_id")
        .in("status", ["new", "in_review", "quote_drafted", "ready_to_send"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("trade_quotes").select("id").eq("status", "draft"),
    ]);
    if (error) return;
    const draftIds = new Set((draftQuotes ?? []).map((q) => q.id));
    const pending = (inquiries ?? []).filter(
      (i) =>
        i.status !== "quote_drafted" ||
        (i.linked_quote_id ? draftIds.has(i.linked_quote_id) : true)
    );
    setItems(pending as NewInquiry[]);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useRealtimeTables(["inquiries", "trade_quotes"], () => load(), isAdmin);

  if (!isAdmin || items.length === 0) return null;

  const latest = items[0];
  const openCount = items.filter((i) => i.status === "new").length;
  const handlingCount = items.length - openCount;
  const headline = [
    openCount > 0 ? `${openCount} open` : null,
    handlingCount > 0 ? `${handlingCount} being handled` : null,
  ].filter(Boolean).join(" · ");

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
              {`${items.length} quote request${items.length === 1 ? "" : "s"} — ${headline}`}
            </p>
            <p className="mt-1 truncate font-body text-sm text-muted-foreground">
              {latest.product_name ?? "Quote request"}
              {" · "}
              {latest.company || latest.email || "Private client"}
              {" · "}
              {relative(latest.created_at)}
              {" · "}
              {STAGE_LABEL[latest.status ?? "new"] ?? "Open"}
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
