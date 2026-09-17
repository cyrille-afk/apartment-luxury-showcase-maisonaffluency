import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

function makeChannelName() {
  return `pending-inquiry-count-${crypto.randomUUID()}`;
}

export function usePendingInquiryCount() {
  const { isAdmin } = useAuth();
  const [count, setCount] = useState(0);
  const [channelName] = useState(makeChannelName);

  const load = async () => {
    const [{ data: inquiries, error }, { data: draftQuotes }] = await Promise.all([
      supabase
        .from("inquiries")
        .select("id, status, linked_quote_id")
        .in("status", ["new", "quote_drafted"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("trade_quotes").select("id").eq("status", "draft"),
    ]);
    if (error) return;
    const draftIds = new Set((draftQuotes ?? []).map((q) => q.id));
    const pending = (inquiries ?? []).filter(
      (i) => i.status === "new" || (i.linked_quote_id && draftIds.has(i.linked_quote_id))
    );
    setCount(pending.length);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel("pending-inquiry-count")
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

  return count;
}
